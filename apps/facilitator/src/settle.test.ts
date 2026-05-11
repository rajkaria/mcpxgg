import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { detailsToWire, payloadToWire } from '@mcpxgg/x402';
import type { PaymentPayload } from '@mcpxgg/x402';
import { settlePayment } from './settle.js';
import { createInMemorySuiBackend } from './sui/in-memory-backend.js';
import { GasStation } from './gas-station.js';
import { ChainError } from './sui/types.js';
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

function input(p: PaymentPayload = payload(), receiptBlobId?: string, success?: boolean) {
  return {
    payload: payloadToWire(p),
    details: detailsToWire(p.details),
    ...(receiptBlobId !== undefined && { receiptBlobId }),
    ...(success !== undefined && { success }),
  };
}

describe('settlePayment — happy path', () => {
  it('submits and returns tx digest + receipt id', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({ sessions: { [SESSION_ID]: baseSession() } });
    const gs = new GasStation({ ratePerMinute: 10, dailyBudgetMist: 1_000_000_000n });
    const r = await settlePayment(input(payload(), 'blob123'), backend, env, gs);
    assert.equal(r.success, true);
    assert.ok(r.txDigest);
    assert.ok(r.receiptObjectId);
    assert.equal(r.settledAmountAtomic, 1_000_000n);
    assert.equal(r.receiptBlobId, 'blob123');
    assert.equal(backend.submitted.length, 1);
  });

  it('debits the session balance', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({ sessions: { [SESSION_ID]: baseSession() } });
    const gs = new GasStation({ ratePerMinute: 10, dailyBudgetMist: 1_000_000_000n });
    await settlePayment(input(), backend, env, gs);
    const s = await backend.getSession(SESSION_ID);
    assert.equal(s?.balanceAtomic, 4_000_000n);
  });
});

describe('settlePayment — failure paths', () => {
  it('returns verify_failed when verification fails', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend(); // no session
    const gs = new GasStation({ ratePerMinute: 10, dailyBudgetMist: 1n });
    const r = await settlePayment(input(), backend, env, gs);
    assert.equal(r.success, false);
    assert.equal(r.errorCode, 'verify_failed');
    assert.equal(backend.submitted.length, 0);
  });

  it('returns chain_error when submit explodes', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({
      sessions: { [SESSION_ID]: baseSession() },
      failSubmitWith: new ChainError('execution_failed', 'bad PTB'),
    });
    const gs = new GasStation({ ratePerMinute: 10, dailyBudgetMist: 1_000_000_000n });
    const r = await settlePayment(input(), backend, env, gs);
    assert.equal(r.success, false);
    assert.equal(r.errorCode, 'chain_error');
  });

  it('returns gas_budget_exceeded when chain reports gas', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({
      sessions: { [SESSION_ID]: baseSession() },
      failSubmitWith: new ChainError('gas_budget_exceeded', 'gas insufficient'),
    });
    const gs = new GasStation({ ratePerMinute: 10, dailyBudgetMist: 1_000_000_000n });
    const r = await settlePayment(input(), backend, env, gs);
    assert.equal(r.errorCode, 'gas_budget_exceeded');
  });

  it('returns rate_limited when gas-station says no', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({ sessions: { [SESSION_ID]: baseSession() } });
    const gs = new GasStation({ ratePerMinute: 1, dailyBudgetMist: 1_000_000_000n });
    await settlePayment(input(), backend, env, gs);
    const r2 = await settlePayment(input(), backend, env, gs);
    assert.equal(r2.success, false);
    assert.equal(r2.errorCode, 'rate_limited');
  });
});
