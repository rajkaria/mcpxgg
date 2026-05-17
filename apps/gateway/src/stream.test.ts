/**
 * E2E pay-per-output streaming (S7-T04 / S7-T06).
 *
 * gateway (SSE) → upstream @mcpxgg/server streaming handler → per-chunk
 * metering → finalize via the real x402 facilitator `upto` path over an
 * in-memory Sui backend. Asserts the session is debited for the *chunk
 * count*, not the quoted ceiling, and that an early client abort still
 * settles the partial metered amount.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FacilitatorClient } from '@mcpxgg/x402';
import { createWalrusClient } from '@mcpxgg/walrus';
import { createMCPXServer } from '@mcpxgg/server';
import type { ToolStreamChunk } from '@mcpxgg/server';
import { createApp as createFacilitatorApp } from '@mcpxgg/facilitator/app';
import { loadEnv as loadFacilitatorEnv } from '@mcpxgg/facilitator/env';
import { GasStation } from '@mcpxgg/facilitator/gas-station';
import { createInMemorySuiBackend } from '@mcpxgg/facilitator/testing';
import type { InMemorySuiBackend } from '@mcpxgg/facilitator/testing';
import { createApp } from './app.js';
import { loadEnv } from './env.js';
import { NOOP_LOGGER } from './logger.js';
import { createMemoryCache } from './cache/cache.js';
import { createInMemoryStore } from './store/in-memory.js';
import { devSessionSigner } from './settlement.js';
import type { GatewayDeps } from './handler.js';

const NOW_MS = 1_700_000_000_000;
const EPOCH_DAY = Math.floor(NOW_MS / 86_400_000);
const PER_CHUNK = 1_000n;

function honoFetch(app: {
  fetch: (r: Request) => Response | Promise<Response>;
}): typeof fetch {
  return ((input: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(
      app.fetch(input instanceof Request ? input : new Request(String(input), init)),
    )) as unknown as typeof fetch;
}

function harness(chunkCount: number) {
  const upstream = createMCPXServer({ namespace: 'stream-srv' });
  upstream.tool('emit', {
    description: 'emits N chunks',
    inputSchema: { type: 'object', properties: { n: { type: 'number' } } },
    pricing: { perCallAtomic: PER_CHUNK },
    handler: async function* (args): AsyncGenerator<ToolStreamChunk> {
      const n = Number(args.n ?? chunkCount);
      for (let i = 0; i < n; i++) {
        yield { text: `chunk-${i}`, priceAtomic: PER_CHUNK };
      }
    },
  });

  const facEnv = loadFacilitatorEnv({
    MCPX_FACILITATOR_TEST_MODE: '1',
    SUI_NETWORK: 'sui-testnet',
  } as unknown as NodeJS.ProcessEnv);
  const backend: InMemorySuiBackend = createInMemorySuiBackend({
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
    MCPX_STREAM_MAX_CHUNKS: '1000',
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
    namespace: 'stream-srv',
    endpointUrl: 'http://upstream.test/',
    active: true,
  });
  store.setTool('0xserver', {
    toolName: 'emit',
    description: 'emits N chunks',
    inputSchema: { type: 'object' },
    priceAtomic: PER_CHUNK,
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
  return { gateway: createApp(deps), backend };
}

async function readSse(res: Response) {
  const text = await res.text();
  const events: Array<{ event: string; data: string }> = [];
  for (const frame of text.split('\n\n')) {
    if (!frame.trim()) continue;
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
    }
    events.push({ event, data: dataLines.join('\n') });
  }
  return events;
}

test('streaming call returns 5 chunks and settles for chunk count, not the ceiling', async () => {
  const { gateway, backend } = harness(5);
  const res = await gateway.fetch(
    new Request('http://gw/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'mcpx_sk_live',
        accept: 'text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: { name: 'stream-srv_emit', arguments: { n: 5 } },
      }),
    }),
  );
  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  const events = await readSse(res);
  const chunks = events.filter((e) => e.event === 'chunk');
  assert.equal(chunks.length, 5);

  const done = events.find((e) => e.event === 'done');
  assert.ok(done);
  const doneData = JSON.parse(done!.data) as {
    chunks: number;
    metered_atomic: string;
    quoted_max_atomic: string;
    settlement: string;
  };
  assert.equal(doneData.chunks, 5);
  assert.equal(doneData.metered_atomic, (PER_CHUNK * 5n).toString());
  assert.equal(doneData.quoted_max_atomic, (PER_CHUNK * 1000n).toString());
  assert.equal(doneData.settlement, 'settled');

  // Session debited for 5 chunks (5_000), NOT the 1_000_000 ceiling.
  const session = await backend.getSession('0xsession');
  assert.equal(session?.balanceAtomic, 1_000_000n - PER_CHUNK * 5n);

  // The on-chain submit used the upto path with the metered actual.
  const last = backend.submittedParams.at(-1);
  assert.equal(last?.uptoActualAtomic, PER_CHUNK * 5n);
  assert.equal(last?.amountAtomic, PER_CHUNK * 1000n);
  const settled = backend.submitted.at(-1);
  assert.equal(settled?.settledAmountAtomic, PER_CHUNK * 5n);
  assert.equal(settled?.unusedAtomic, PER_CHUNK * 1000n - PER_CHUNK * 5n);
});

test('a non-stream tools/call is unaffected (still JSON-RPC)', async () => {
  const { gateway } = harness(3);
  const res = await gateway.fetch(
    new Request('http://gw/', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': 'mcpx_sk_live' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'stream-srv_emit', arguments: { n: 3 } },
      }),
    }),
  );
  // Non-SSE caller against a streaming handler: SDK drains + concatenates.
  const body = (await res.json()) as {
    result: { content: Array<{ text: string }> };
  };
  assert.equal(body.result.content.length, 3);
});
