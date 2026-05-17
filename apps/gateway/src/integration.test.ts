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
});
