/**
 * End-to-end: gateway → real x402 facilitator (in-memory Sui backend) →
 * receipt. The upstream MCP server is a real @mcpxgg/server instance. Only
 * the chain and Walrus are in-memory; every wire hop is exercised.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FacilitatorClient } from '@mcpxgg/x402';
import { createWalrusClient } from '@mcpxgg/walrus';
import { createMCPXServer } from '@mcpxgg/server';
import { createApp as createFacilitatorApp } from '@mcpxgg/facilitator/app';
import { loadEnv as loadFacilitatorEnv } from '@mcpxgg/facilitator/env';
import { GasStation } from '@mcpxgg/facilitator/gas-station';
import { createInMemorySuiBackend } from '@mcpxgg/facilitator/testing';
import { createApp } from './app.js';
import { loadEnv } from './env.js';
import { NOOP_LOGGER } from './logger.js';
import { createMemoryCache } from './cache/cache.js';
import { createInMemoryStore } from './store/in-memory.js';
import { devSessionSigner } from './settlement.js';
import type { GatewayDeps } from './handler.js';

const NOW_MS = 1_700_000_000_000;
const EPOCH_DAY = Math.floor(NOW_MS / 86_400_000);

function honoFetch(app: { fetch: (r: Request) => Response | Promise<Response> }): typeof fetch {
  return ((input: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(
      app.fetch(input instanceof Request ? input : new Request(String(input), init)),
    )) as unknown as typeof fetch;
}

test('settles a paid call end-to-end and returns a verifiable receipt', async () => {
  // Upstream MCP server.
  const upstream = createMCPXServer({ namespace: 'walrus-search' });
  upstream.tool('query', {
    description: 'semantic search',
    inputSchema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
    pricing: { perCallAtomic: 5_000n },
    handler: (args, ctx) => ({ hits: [`result for ${String(args.q)}`], payer: ctx.payerAddress }),
  });

  // Real facilitator over an in-memory Sui backend, seeded with the session.
  const facEnv = loadFacilitatorEnv({
    MCPX_FACILITATOR_TEST_MODE: '1',
    SUI_NETWORK: 'sui-testnet',
  } as unknown as NodeJS.ProcessEnv);
  const backend = createInMemorySuiBackend({
    initialNowMs: NOW_MS,
    sessions: {
      '0xsession': {
        sessionObjectId: '0xsession',
        ownerAddress: '0xowner',
        active: true,
        balanceAtomic: 1_000_000n,
        perCallCapAtomic: 0n,
        perDayCapAtomic: 0n,
        todaySpentAtomic: 0n,
        todayEpochDay: EPOCH_DAY,
        scopedServerObjectIds: [],
        expiresAtMs: null,
      },
    },
  });
  const facilitatorApp = createFacilitatorApp({
    env: facEnv,
    backend,
    gasStation: new GasStation({ ratePerMinute: 600, dailyBudgetMist: 10_000_000_000n }),
  });

  // Gateway wired to the facilitator + the upstream server.
  const env = loadEnv({
    MCPX_GATEWAY_TEST_MODE: '1',
    SUI_NETWORK: 'sui-testnet',
  } as unknown as NodeJS.ProcessEnv);
  const store = createInMemoryStore();
  store.setAuth('mcpx_sk_live', {
    userId: 'u1',
    apiKey: 'mcpx_sk_live',
    ownerAddress: '0xowner',
    sessionObjectId: '0xsession',
    balanceAtomic: 1_000_000n,
    perCallCapAtomic: 0n,
    perDayCapAtomic: 0n,
    todaySpentAtomic: 0n,
    todayEpochDay: EPOCH_DAY,
    scopedServerObjectIds: [],
    active: true,
    expiresAtMs: null,
  });
  store.setServer({
    serverObjectId: '0xserver',
    namespace: 'walrus-search',
    endpointUrl: 'http://upstream.test/',
    active: true,
  });
  store.setTool('0xserver', {
    toolName: 'query',
    description: 'semantic search',
    inputSchema: { type: 'object' },
    priceAtomic: 5_000n,
    freeTierCallsPerUser: 0,
    timeoutSeconds: 30,
  });

  const deps: GatewayDeps = {
    env,
    store,
    cache: createMemoryCache(),
    facilitator: new FacilitatorClient({
      baseUrl: 'http://facilitator.test',
      fetchImpl: honoFetch(facilitatorApp),
    }),
    signer: devSessionSigner,
    walrus: createWalrusClient(),
    logger: NOOP_LOGGER,
    fetchImpl: honoFetch({ fetch: upstream.fetch }),
    now: () => NOW_MS + 100_000,
  };
  const gateway = createApp(deps);

  const res = await gateway.fetch(
    new Request('http://gw/', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': 'mcpx_sk_live' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: { name: 'walrus-search_query', arguments: { q: 'sui' } },
      }),
    }),
  );
  const body = (await res.json()) as {
    result: {
      isError: boolean;
      content: Array<{ text: string }>;
      _meta: {
        receipt: {
          settlement: string;
          tx_digest?: string;
          blob_id?: string;
          explorer_url?: string;
          amount_atomic: string;
          attribution: string;
        };
      };
    };
  };

  assert.equal(body.result.isError, false);
  const r = body.result._meta.receipt;
  assert.equal(r.settlement, 'settled');
  assert.equal(r.amount_atomic, '5000');
  assert.ok(r.tx_digest && r.tx_digest.startsWith('0xtx'), 'tx digest present');
  assert.ok(r.blob_id && r.blob_id.startsWith('mem:'), 'walrus blob archived');
  assert.match(r.explorer_url ?? '', /suiscan\.xyz\/testnet\/tx/);
  assert.equal(r.attribution, 'Powered by mcpxgg');

  // Upstream handler actually ran and saw the payer.
  const payload = JSON.parse(body.result.content[0]!.text) as { payer: string };
  assert.equal(payload.payer, '0xowner');

  // Chain state debited by exactly the price.
  const session = await backend.getSession('0xsession');
  assert.equal(session?.balanceAtomic, 1_000_000n - 5_000n);
  assert.equal(backend.submitted.length, 1);
  // No intent header → settle_call path (no intentId on the submit).
  assert.equal(backend.submittedParams[0]?.intentId, undefined);
});

// ─── Spending-intent integration (S6-T06) ──────────────────────────────────

interface IntentHarness {
  gateway: ReturnType<typeof createApp>;
  backend: ReturnType<typeof createInMemorySuiBackend>;
  store: ReturnType<typeof createInMemoryStore>;
}

function makeIntentHarness(): IntentHarness {
  const upstream = createMCPXServer({ namespace: 'walrus-search' });
  upstream.tool('query', {
    description: 'semantic search',
    inputSchema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
    pricing: { perCallAtomic: 5_000n },
    handler: (args) => ({ hits: [`result for ${String(args.q)}`] }),
  });

  const facEnv = loadFacilitatorEnv({
    MCPX_FACILITATOR_TEST_MODE: '1',
    SUI_NETWORK: 'sui-testnet',
  } as unknown as NodeJS.ProcessEnv);
  const backend = createInMemorySuiBackend({
    initialNowMs: NOW_MS,
    sessions: {
      '0xsession': {
        sessionObjectId: '0xsession',
        ownerAddress: '0xowner',
        active: true,
        balanceAtomic: 1_000_000n,
        perCallCapAtomic: 0n,
        perDayCapAtomic: 0n,
        todaySpentAtomic: 0n,
        todayEpochDay: EPOCH_DAY,
        scopedServerObjectIds: [],
        expiresAtMs: null,
      },
    },
  });
  const facilitatorApp = createFacilitatorApp({
    env: facEnv,
    backend,
    gasStation: new GasStation({ ratePerMinute: 600, dailyBudgetMist: 10_000_000_000n }),
  });

  const env = loadEnv({
    MCPX_GATEWAY_TEST_MODE: '1',
    SUI_NETWORK: 'sui-testnet',
  } as unknown as NodeJS.ProcessEnv);
  const store = createInMemoryStore();
  store.setAuth('mcpx_sk_live', {
    userId: 'u1',
    apiKey: 'mcpx_sk_live',
    ownerAddress: '0xowner',
    sessionObjectId: '0xsession',
    balanceAtomic: 1_000_000n,
    perCallCapAtomic: 0n,
    perDayCapAtomic: 0n,
    todaySpentAtomic: 0n,
    todayEpochDay: EPOCH_DAY,
    scopedServerObjectIds: [],
    active: true,
    expiresAtMs: null,
  });
  store.setServer({
    serverObjectId: '0xserver',
    namespace: 'walrus-search',
    endpointUrl: 'http://upstream.test/',
    active: true,
  });
  store.setTool('0xserver', {
    toolName: 'query',
    description: 'semantic search',
    inputSchema: { type: 'object' },
    priceAtomic: 5_000n,
    freeTierCallsPerUser: 0,
    timeoutSeconds: 30,
  });
  store.setIntent({
    intentObjectId: '0xintent',
    agentAddress: '0xowner',
    dailyCapAtomic: 100_000n,
    perCallCapAtomic: 10_000n,
    serverObjectIds: ['0xserver'],
    allowedCategories: ['intelligence'],
    todaySpentAtomic: 0n,
    todayEpochDay: EPOCH_DAY,
    expiresAtMs: 0,
    revoked: false,
  });

  const deps: GatewayDeps = {
    env,
    store,
    cache: createMemoryCache(),
    facilitator: new FacilitatorClient({
      baseUrl: 'http://facilitator.test',
      fetchImpl: honoFetch(facilitatorApp),
    }),
    signer: devSessionSigner,
    walrus: createWalrusClient(),
    logger: NOOP_LOGGER,
    fetchImpl: honoFetch({ fetch: upstream.fetch }),
    now: () => NOW_MS + 100_000,
  };
  return { gateway: createApp(deps), backend, store };
}

function intentCall(
  gateway: ReturnType<typeof createApp>,
  headers: Record<string, string>,
) {
  return gateway.fetch(
    new Request('http://gw/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'mcpx_sk_live',
        ...headers,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: { name: 'walrus-search_query', arguments: { q: 'sui' } },
      }),
    }),
  );
}

test('valid intent settles via the intent path', async () => {
  const h = makeIntentHarness();
  const res = await intentCall(h.gateway, {
    'x-mcpx-intent-id': '0xintent',
    'x-mcpx-category': 'intelligence',
  });
  const body = (await res.json()) as {
    result: { isError: boolean; _meta: { receipt: { settlement: string } } };
  };
  assert.equal(body.result.isError, false);
  assert.equal(body.result._meta.receipt.settlement, 'settled');
  assert.equal(h.backend.submitted.length, 1);
  // The facilitator received the intent + category → settle_call_with_intent.
  assert.equal(h.backend.submittedParams[0]?.intentId, '0xintent');
  assert.equal(h.backend.submittedParams[0]?.category, 'intelligence');
  const session = await h.backend.getSession('0xsession');
  assert.equal(session?.balanceAtomic, 1_000_000n - 5_000n);
});

test('revoked intent is rejected with no settlement', async () => {
  const h = makeIntentHarness();
  h.store.setIntent({
    intentObjectId: '0xintent',
    agentAddress: '0xowner',
    dailyCapAtomic: 0n,
    perCallCapAtomic: 0n,
    serverObjectIds: [],
    allowedCategories: [],
    todaySpentAtomic: 0n,
    todayEpochDay: EPOCH_DAY,
    expiresAtMs: 0,
    revoked: true,
  });
  const res = await intentCall(h.gateway, { 'x-mcpx-intent-id': '0xintent' });
  const body = (await res.json()) as {
    result: { isError: boolean; _meta: { error_code: string } };
  };
  assert.equal(body.result.isError, true);
  assert.equal(body.result._meta.error_code, 'intent_revoked');
  assert.equal(h.backend.submitted.length, 0);
});

test('expired intent rejected, no settlement', async () => {
  const h = makeIntentHarness();
  h.store.setIntent({
    intentObjectId: '0xintent',
    agentAddress: '0xowner',
    dailyCapAtomic: 0n,
    perCallCapAtomic: 0n,
    serverObjectIds: [],
    allowedCategories: [],
    todaySpentAtomic: 0n,
    todayEpochDay: EPOCH_DAY,
    expiresAtMs: NOW_MS, // now() = NOW_MS + 100_000 > expiry
    revoked: false,
  });
  const res = await intentCall(h.gateway, { 'x-mcpx-intent-id': '0xintent' });
  const body = (await res.json()) as { result: { _meta: { error_code: string } } };
  assert.equal(body.result._meta.error_code, 'intent_expired');
  assert.equal(h.backend.submitted.length, 0);
});

test('server out of intent scope rejected, no settlement', async () => {
  const h = makeIntentHarness();
  h.store.setIntent({
    intentObjectId: '0xintent',
    agentAddress: '0xowner',
    dailyCapAtomic: 0n,
    perCallCapAtomic: 0n,
    serverObjectIds: ['0xother'],
    allowedCategories: [],
    todaySpentAtomic: 0n,
    todayEpochDay: EPOCH_DAY,
    expiresAtMs: 0,
    revoked: false,
  });
  const res = await intentCall(h.gateway, { 'x-mcpx-intent-id': '0xintent' });
  const body = (await res.json()) as { result: { _meta: { error_code: string } } };
  assert.equal(body.result._meta.error_code, 'intent_scope_mismatch');
  assert.equal(h.backend.submitted.length, 0);
});

test('category not allowed rejected, no settlement', async () => {
  const h = makeIntentHarness();
  const res = await intentCall(h.gateway, {
    'x-mcpx-intent-id': '0xintent',
    'x-mcpx-category': 'data', // intent only allows 'intelligence'
  });
  const body = (await res.json()) as { result: { _meta: { error_code: string } } };
  assert.equal(body.result._meta.error_code, 'intent_category_not_allowed');
  assert.equal(h.backend.submitted.length, 0);
});

test('per-call cap exceeded rejected, no settlement', async () => {
  const h = makeIntentHarness();
  h.store.setIntent({
    intentObjectId: '0xintent',
    agentAddress: '0xowner',
    dailyCapAtomic: 0n,
    perCallCapAtomic: 1_000n, // call costs 5_000
    serverObjectIds: [],
    allowedCategories: [],
    todaySpentAtomic: 0n,
    todayEpochDay: EPOCH_DAY,
    expiresAtMs: 0,
    revoked: false,
  });
  const res = await intentCall(h.gateway, { 'x-mcpx-intent-id': '0xintent' });
  const body = (await res.json()) as { result: { _meta: { error_code: string } } };
  assert.equal(body.result._meta.error_code, 'intent_per_call_cap_exceeded');
  assert.equal(h.backend.submitted.length, 0);
});

test('daily cap exceeded rejected, no settlement', async () => {
  const h = makeIntentHarness();
  h.store.setIntent({
    intentObjectId: '0xintent',
    agentAddress: '0xowner',
    dailyCapAtomic: 6_000n,
    perCallCapAtomic: 0n,
    serverObjectIds: [],
    allowedCategories: [],
    todaySpentAtomic: 5_000n, // + 5_000 call > 6_000 cap
    todayEpochDay: EPOCH_DAY,
    expiresAtMs: 0,
    revoked: false,
  });
  const res = await intentCall(h.gateway, { 'x-mcpx-intent-id': '0xintent' });
  const body = (await res.json()) as { result: { _meta: { error_code: string } } };
  assert.equal(body.result._meta.error_code, 'intent_daily_cap_exceeded');
  assert.equal(h.backend.submitted.length, 0);
});
