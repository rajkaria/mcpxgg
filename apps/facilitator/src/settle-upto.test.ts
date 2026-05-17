import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { detailsToWire, payloadToWire, uptoSettleExtraToWire } from '@mcpxgg/x402';
import type { PaymentPayload } from '@mcpxgg/x402';
import { settlePayment } from './settle.js';
import { createInMemorySuiBackend } from './sui/in-memory-backend.js';
import { GasStation } from './gas-station.js';
import type { SessionView } from './sui/types.js';
import { loadEnv } from './env.js';

const TOKEN = '0xtest::usdsui::USDSUI';
const SESSION_ID = '0xsess';
const SERVER_ID = '0xsrv';
const PAYER = '0xpayer';

function envForTests() {
  return loadEnv({ MCPX_FACILITATOR_TEST_MODE: '1', USDSUI_COIN_TYPE: TOKEN });
}

function baseSession(overrides: Partial<SessionView> = {}): SessionView {
  return {
    sessionObjectId: SESSION_ID,
    ownerAddress: PAYER,
    active: true,
    balanceAtomic: 5_000_000n,
    perCallCapAtomic: 0n,
    perDayCapAtomic: 0n,
    todaySpentAtomic: 0n,
    todayEpochDay: 0,
    scopedServerObjectIds: [],
    expiresAtMs: null,
    ...overrides,
  };
}

function uptoPayload(maxAtomic: bigint): PaymentPayload {
  return {
    signature: `valid:${PAYER}`,
    payerAddress: PAYER,
    sessionObjectId: SESSION_ID,
    details: {
      scheme: 'upto',
      network: 'sui-testnet',
      serverObjectId: SERVER_ID,
      toolName: 'stream',
      amountAtomic: maxAtomic,
      tokenType: TOKEN,
      validUntilMs: 9_999_999_999_999,
    },
  };
}

function gs() {
  return new GasStation({ ratePerMinute: 100, dailyBudgetMist: 1_000_000_000n });
}

describe('settlePayment — upto scheme', () => {
  it('debits only the metered actual; balance reflects refund of unused', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({
      sessions: { [SESSION_ID]: baseSession() },
    });
    const p = uptoPayload(1_000_000n);
    const r = await settlePayment(
      {
        payload: payloadToWire(p),
        details: detailsToWire(p.details),
        uptoExtra: { actualAtomic: 300_000n },
      },
      backend,
      env,
      gs(),
    );
    assert.equal(r.success, true);
    assert.equal(r.settledAmountAtomic, 300_000n);
    assert.equal(r.quotedMaxAtomic, 1_000_000n);
    assert.equal(r.unusedAtomic, 700_000n);
    const session = await backend.getSession(SESSION_ID);
    // Only 300k debited from the 5M balance — unused 700k never moved.
    assert.equal(session?.balanceAtomic, 4_700_000n);
  });

  it('rejects actual greater than the signed ceiling (verify_failed)', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({
      sessions: { [SESSION_ID]: baseSession() },
    });
    const p = uptoPayload(1_000_000n);
    const r = await settlePayment(
      {
        payload: payloadToWire(p),
        details: detailsToWire(p.details),
        uptoExtra: { actualAtomic: 2_000_000n },
      },
      backend,
      env,
      gs(),
    );
    assert.equal(r.success, false);
    assert.equal(r.errorCode, 'verify_failed');
    assert.match(r.errorMessage ?? '', /exceeds quoted max/);
    // Nothing debited.
    const session = await backend.getSession(SESSION_ID);
    assert.equal(session?.balanceAtomic, 5_000_000n);
  });

  it('settles zero on an early abort with no metered usage', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({
      sessions: { [SESSION_ID]: baseSession() },
    });
    const p = uptoPayload(1_000_000n);
    const r = await settlePayment(
      {
        payload: payloadToWire(p),
        details: detailsToWire(p.details),
        uptoExtra: { actualAtomic: 0n },
        success: false,
      },
      backend,
      env,
      gs(),
    );
    assert.equal(r.success, true);
    assert.equal(r.settledAmountAtomic, 0n);
    assert.equal(r.unusedAtomic, 1_000_000n);
  });

  it('wire-roundtrips the upto extra through the parser', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({
      sessions: { [SESSION_ID]: baseSession() },
    });
    const p = uptoPayload(800_000n);
    const wireExtra = uptoSettleExtraToWire({ actualAtomic: 250_000n });
    // simulate what app.ts does: parse the wire shape then settle
    const { parseUptoSettleExtra } = await import('@mcpxgg/x402');
    const parsed = parseUptoSettleExtra(wireExtra);
    const r = await settlePayment(
      {
        payload: payloadToWire(p),
        details: detailsToWire(p.details),
        ...(parsed !== undefined && { uptoExtra: parsed }),
      },
      backend,
      env,
      gs(),
    );
    assert.equal(r.settledAmountAtomic, 250_000n);
  });
});
