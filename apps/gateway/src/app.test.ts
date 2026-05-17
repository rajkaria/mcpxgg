import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FacilitatorClient } from '@mcpxgg/x402';
import { createWalrusClient } from '@mcpxgg/walrus';
import { createApp } from './app.js';
import { loadEnv } from './env.js';
import { NOOP_LOGGER } from './logger.js';
import { createMemoryCache } from './cache/cache.js';
import { createInMemoryStore } from './store/in-memory.js';
import { devSessionSigner } from './settlement.js';
import type { GatewayDeps } from './handler.js';
import type { AuthContext } from './store/store.js';

const ENV = loadEnv({ MCPX_GATEWAY_TEST_MODE: '1' } as unknown as NodeJS.ProcessEnv);

function baseAuth(over: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: 'u1',
    apiKey: 'mcpx_sk_test',
    ownerAddress: '0xowner',
    sessionObjectId: '0xsession',
    balanceAtomic: 1_000_000n,
    perCallCapAtomic: 0n,
    perDayCapAtomic: 0n,
    todaySpentAtomic: 0n,
    todayEpochDay: null,
    scopedServerObjectIds: [],
    active: true,
    expiresAtMs: null,
    ...over,
  };
}

function deps(over: Partial<GatewayDeps> = {}): { deps: GatewayDeps; store: ReturnType<typeof createInMemoryStore> } {
  const store = createInMemoryStore();
  const d: GatewayDeps = {
    env: ENV,
    store,
    cache: createMemoryCache(),
    facilitator: new FacilitatorClient({ baseUrl: 'http://fac.test' }),
    signer: devSessionSigner,
    walrus: createWalrusClient(),
    logger: NOOP_LOGGER,
    now: () => 1_700_000_100_000,
    ...over,
  };
  return { deps: d, store };
}

function rpc(app: ReturnType<typeof createApp>, method: string, params?: unknown, key = 'mcpx_sk_test') {
  return app.fetch(
    new Request('http://gw/', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }),
  );
}

test('missing api key → 401 auth_required', async () => {
  const { deps: d } = deps();
  const app = createApp(d);
  const res = await app.fetch(
    new Request('http://gw/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
    }),
  );
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error: { data: { error_code: string } } };
  assert.equal(body.error.data.error_code, 'auth_required');
});

test('invalid api key → invalid_api_key', async () => {
  const { deps: d } = deps();
  const res = await rpc(createApp(d), 'initialize', undefined, 'nope');
  const body = (await res.json()) as { error: { data: { error_code: string } } };
  assert.equal(body.error.data.error_code, 'invalid_api_key');
});

test('initialize returns protocol version for a valid key', async () => {
  const { deps: d, store } = deps();
  store.setAuth('mcpx_sk_test', baseAuth());
  const body = (await (await rpc(createApp(d), 'initialize')).json()) as {
    result: { protocolVersion: string };
  };
  assert.equal(body.result.protocolVersion, '2025-03-26');
});

test('tools/list surfaces scoped servers with price metadata', async () => {
  const { deps: d, store } = deps();
  store.setAuth('mcpx_sk_test', baseAuth());
  store.setServer({ serverObjectId: '0xs', namespace: 'demo', endpointUrl: 'http://s', active: true });
  store.setTool('0xs', {
    toolName: 'q',
    description: 'query',
    inputSchema: { type: 'object' },
    priceAtomic: 5000n,
    freeTierCallsPerUser: 0,
    timeoutSeconds: 30,
  });
  const body = (await (await rpc(createApp(d), 'tools/list')).json()) as {
    result: { tools: Array<{ name: string; _meta: { price_atomic: string } }> };
  };
  assert.equal(body.result.tools[0]?.name, 'demo_q');
  assert.equal(body.result.tools[0]?._meta.price_atomic, '5000');
});

test('unknown server → server_not_found tool error', async () => {
  const { deps: d, store } = deps();
  store.setAuth('mcpx_sk_test', baseAuth());
  const body = (await (
    await rpc(createApp(d), 'tools/call', { name: 'ghost_x', arguments: {} })
  ).json()) as { result: { isError: boolean; _meta: { error_code: string } } };
  assert.equal(body.result.isError, true);
  assert.equal(body.result._meta.error_code, 'server_not_found');
});

test('insufficient balance rejected in preflight (no upstream call)', async () => {
  const { deps: d, store } = deps();
  store.setAuth('mcpx_sk_test', baseAuth({ balanceAtomic: 1n }));
  store.setServer({ serverObjectId: '0xs', namespace: 'demo', endpointUrl: 'http://s', active: true });
  store.setTool('0xs', {
    toolName: 'q',
    description: '',
    inputSchema: {},
    priceAtomic: 5000n,
    freeTierCallsPerUser: 0,
    timeoutSeconds: 30,
  });
  let upstreamCalled = false;
  d.fetchImpl = (async () => {
    upstreamCalled = true;
    return new Response('{}');
  }) as unknown as typeof fetch;
  const body = (await (
    await rpc(createApp(d), 'tools/call', { name: 'demo_q', arguments: {} })
  ).json()) as { result: { _meta: { error_code: string } } };
  assert.equal(body.result._meta.error_code, 'insufficient_balance');
  assert.equal(upstreamCalled, false);
});

test('server error → no settlement, error surfaced', async () => {
  const { deps: d, store } = deps();
  store.setAuth('mcpx_sk_test', baseAuth());
  store.setServer({ serverObjectId: '0xs', namespace: 'demo', endpointUrl: 'http://s', active: true });
  store.setTool('0xs', {
    toolName: 'q',
    description: '',
    inputSchema: {},
    priceAtomic: 5000n,
    freeTierCallsPerUser: 0,
    timeoutSeconds: 30,
  });
  d.fetchImpl = (async () =>
    new Response(JSON.stringify({ error: { message: 'boom' } }), { status: 200 })) as unknown as typeof fetch;
  let settleHit = false;
  d.facilitator = new FacilitatorClient({
    baseUrl: 'http://fac.test',
    fetchImpl: (async () => {
      settleHit = true;
      return new Response('{}');
    }) as unknown as typeof fetch,
  });
  const body = (await (
    await rpc(createApp(d), 'tools/call', { name: 'demo_q', arguments: {} })
  ).json()) as { result: { isError: boolean } };
  assert.equal(body.result.isError, true);
  assert.equal(settleHit, false);
});

test('free-tier call returns settlement:free and does not settle', async () => {
  const { deps: d, store } = deps();
  store.setAuth('mcpx_sk_test', baseAuth());
  store.setServer({ serverObjectId: '0xs', namespace: 'demo', endpointUrl: 'http://s', active: true });
  store.setTool('0xs', {
    toolName: 'q',
    description: '',
    inputSchema: {},
    priceAtomic: 5000n,
    freeTierCallsPerUser: 1,
    timeoutSeconds: 30,
  });
  d.fetchImpl = (async () =>
    new Response(JSON.stringify({ result: { content: [{ type: 'text', text: 'ok' }] } }))) as unknown as typeof fetch;
  let settleHit = false;
  d.facilitator = new FacilitatorClient({
    baseUrl: 'http://fac.test',
    fetchImpl: (async () => {
      settleHit = true;
      return new Response('{}');
    }) as unknown as typeof fetch,
  });
  const body = (await (
    await rpc(createApp(d), 'tools/call', { name: 'demo_q', arguments: {} })
  ).json()) as { result: { _meta: { receipt: { settlement: string; amount_atomic: string } } } };
  assert.equal(body.result._meta.receipt.settlement, 'free');
  assert.equal(body.result._meta.receipt.amount_atomic, '0');
  assert.equal(settleHit, false);
});
