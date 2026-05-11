import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { detailsToWire, payloadToWire } from '@mcpxgg/x402';
import type { PaymentPayload } from '@mcpxgg/x402';
import { createApp } from './app.js';
import { createInMemorySuiBackend } from './sui/in-memory-backend.js';
import type { SessionView } from './sui/types.js';
import { GasStation } from './gas-station.js';
import { loadEnv } from './env.js';

const TOKEN = '0xtest::usdsui::USDSUI';
const SESSION_ID = '0xsess';
const SERVER_ID = '0xsrv';
const PAYER = '0xpayer';

function setup() {
  const env = loadEnv({ MCPX_FACILITATOR_TEST_MODE: '1', USDSUI_COIN_TYPE: TOKEN });
  const session: SessionView = {
    sessionObjectId: SESSION_ID,
    ownerAddress: PAYER,
    active: true,
    balanceAtomic: 10_000_000n,
    perCallCapAtomic: 2_000_000n,
    perDayCapAtomic: 0n,
    todaySpentAtomic: 0n,
    todayEpochDay: 0,
    scopedServerObjectIds: [],
    expiresAtMs: null,
  };
  const backend = createInMemorySuiBackend({ sessions: { [SESSION_ID]: session } });
  const gasStation = new GasStation({ ratePerMinute: 30, dailyBudgetMist: 1_000_000_000n });
  const app = createApp({ env, backend, gasStation });
  return { app, env, backend, gasStation };
}

function payload(): PaymentPayload {
  return {
    signature: `valid:${PAYER}`,
    payerAddress: PAYER,
    sessionObjectId: SESSION_ID,
    details: {
      scheme: 'exact',
      network: 'sui-testnet',
      serverObjectId: SERVER_ID,
      toolName: 'query',
      amountAtomic: 1_000_000n,
      tokenType: TOKEN,
      validUntilMs: 9_999_999_999_999,
    },
  };
}

async function postJson(app: ReturnType<typeof createApp>, path: string, body: unknown) {
  return app.fetch(
    new Request(`http://test${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

describe('HTTP /supported', () => {
  it('lists supported schemes + network + token', async () => {
    const { app } = setup();
    const res = await app.fetch(new Request('http://test/supported'));
    assert.equal(res.status, 200);
    const json = (await res.json()) as Record<string, unknown>;
    assert.deepEqual(json.schemes, ['exact', 'upto']);
    assert.deepEqual(json.networks, ['sui-testnet']);
    assert.equal(json.tokenType, TOKEN);
    assert.equal(json.x402Version, '0.1.0');
  });
});

describe('HTTP /health', () => {
  it('returns ok', async () => {
    const { app } = setup();
    const res = await app.fetch(new Request('http://test/health'));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  });
});

describe('HTTP /verify', () => {
  it('returns isValid=true on a good payload', async () => {
    const { app } = setup();
    const p = payload();
    const res = await postJson(app, '/verify', {
      payload: payloadToWire(p),
      details: detailsToWire(p.details),
    });
    assert.equal(res.status, 200);
    const json = (await res.json()) as { isValid: boolean };
    assert.equal(json.isValid, true);
  });

  it('returns isValid=false with reason on malformed body', async () => {
    const { app } = setup();
    const res = await postJson(app, '/verify', { payload: {}, details: {} });
    const json = (await res.json()) as { isValid: boolean; invalidReason: string };
    assert.equal(json.isValid, false);
    assert.equal(json.invalidReason, 'malformed_payload');
  });

  it('returns 400 on invalid JSON', async () => {
    const { app } = setup();
    const res = await app.fetch(
      new Request('http://test/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not json',
      }),
    );
    assert.equal(res.status, 400);
  });
});

describe('HTTP /settle', () => {
  it('returns settled result', async () => {
    const { app, backend } = setup();
    const p = payload();
    const res = await postJson(app, '/settle', {
      payload: payloadToWire(p),
      details: detailsToWire(p.details),
      receiptBlobId: 'walrus-blob-id',
    });
    assert.equal(res.status, 200);
    const json = (await res.json()) as {
      success: boolean;
      txDigest: string;
      settledAmountAtomic: string;
      receiptBlobId: string;
    };
    assert.equal(json.success, true);
    assert.ok(json.txDigest.startsWith('0xtx'));
    assert.equal(json.settledAmountAtomic, '1000000');
    assert.equal(json.receiptBlobId, 'walrus-blob-id');
    assert.equal(backend.submitted.length, 1);
  });

  it('returns 400 on verify failure', async () => {
    const { app } = setup();
    const bad = payload();
    bad.signature = 'no-good';
    const res = await postJson(app, '/settle', {
      payload: payloadToWire(bad),
      details: detailsToWire(bad.details),
    });
    assert.equal(res.status, 400);
    const json = (await res.json()) as { success: boolean; errorCode: string };
    assert.equal(json.success, false);
    assert.equal(json.errorCode, 'verify_failed');
  });

  it('returns 429 on rate limit', async () => {
    const { app, env, backend } = setup();
    const tight = new GasStation({ ratePerMinute: 1, dailyBudgetMist: 1_000_000_000n });
    const tightApp = createApp({ env, backend, gasStation: tight });
    const p = payload();
    await postJson(tightApp, '/settle', { payload: payloadToWire(p), details: detailsToWire(p.details) });
    const res = await postJson(tightApp, '/settle', { payload: payloadToWire(p), details: detailsToWire(p.details) });
    assert.equal(res.status, 429);
  });
});

describe('HTTP /admin/gas-station', () => {
  it('reports snapshot', async () => {
    const { app, gasStation } = setup();
    gasStation.record(123n);
    const res = await app.fetch(new Request('http://test/admin/gas-station'));
    const json = (await res.json()) as { rateUsed: number; spentTodayMist: string };
    assert.equal(json.rateUsed, 1);
    assert.equal(json.spentTodayMist, '123');
  });
});
