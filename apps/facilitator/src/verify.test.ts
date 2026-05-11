import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { detailsToWire, payloadToWire } from '@mcpxgg/x402';
import type { PaymentDetails, PaymentPayload } from '@mcpxgg/x402';
import { canonicalMessage, verifyPayment } from './verify.js';
import { createInMemorySuiBackend } from './sui/in-memory-backend.js';
import type { SessionView } from './sui/types.js';
import { loadEnv } from './env.js';

const TOKEN = '0xtest::usdsui::USDSUI';
const SERVER_ID = '0xsrv';
const SESSION_ID = '0xsess';
const PAYER = '0xpayer';

function baseDetails(overrides: Partial<PaymentDetails> = {}): PaymentDetails {
  return {
    scheme: 'exact',
    network: 'sui-testnet',
    serverObjectId: SERVER_ID,
    toolName: 'query',
    amountAtomic: 1_000_000n,
    tokenType: TOKEN,
    validUntilMs: 9_999_999_999_999,
    ...overrides,
  };
}

function basePayload(overrides: Partial<PaymentPayload> = {}, dOverrides: Partial<PaymentDetails> = {}): PaymentPayload {
  const details = baseDetails(dOverrides);
  return {
    signature: `valid:${PAYER}`,
    payerAddress: PAYER,
    sessionObjectId: SESSION_ID,
    details,
    ...overrides,
  };
}

function baseSession(overrides: Partial<SessionView> = {}): SessionView {
  return {
    sessionObjectId: SESSION_ID,
    ownerAddress: PAYER,
    active: true,
    balanceAtomic: 10_000_000n,
    perCallCapAtomic: 2_000_000n,
    perDayCapAtomic: 8_000_000n,
    todaySpentAtomic: 0n,
    todayEpochDay: 0,
    scopedServerObjectIds: [],
    expiresAtMs: null,
    ...overrides,
  };
}

function envForTests() {
  return loadEnv({ MCPX_FACILITATOR_TEST_MODE: '1', USDSUI_COIN_TYPE: TOKEN });
}

function input(payload: PaymentPayload) {
  return { payload: payloadToWire(payload), details: detailsToWire(payload.details) };
}

describe('verifyPayment — happy path', () => {
  it('accepts a fully valid payload', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({
      sessions: { [SESSION_ID]: baseSession() },
    });
    const r = await verifyPayment(input(basePayload()), backend, env);
    assert.equal(r.isValid, true);
  });
});

describe('verifyPayment — shape failures', () => {
  it('rejects unparseable details', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend();
    const r = await verifyPayment(
      { payload: {}, details: { scheme: 'exact' } },
      backend,
      env,
    );
    assert.equal(r.isValid, false);
    assert.equal(r.invalidReason, 'malformed_payload');
  });

  it('rejects mismatched network', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({ sessions: { [SESSION_ID]: baseSession() } });
    const r = await verifyPayment(input(basePayload({}, { network: 'sui-mainnet' })), backend, env);
    assert.equal(r.invalidReason, 'unsupported_network');
  });

  it('rejects mismatched token', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({ sessions: { [SESSION_ID]: baseSession() } });
    const r = await verifyPayment(
      input(basePayload({}, { tokenType: '0xfoo::other::T' })),
      backend,
      env,
    );
    assert.equal(r.invalidReason, 'unsupported_scheme');
  });

  it('rejects expired quote', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({
      sessions: { [SESSION_ID]: baseSession() },
      initialNowMs: 10_000_000,
    });
    const r = await verifyPayment(
      input(basePayload({}, { validUntilMs: 1 })),
      backend,
      env,
    );
    assert.equal(r.invalidReason, 'expired_quote');
  });

  it('rejects tampered echoed details (different toolName)', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({ sessions: { [SESSION_ID]: baseSession() } });
    const wire = payloadToWire(basePayload());
    const tampered = { ...detailsToWire(baseDetails()), toolName: 'OTHER' };
    const r = await verifyPayment({ payload: wire, details: tampered }, backend, env);
    assert.equal(r.invalidReason, 'malformed_payload');
  });
});

describe('verifyPayment — chain failures', () => {
  it('refuses while platform is paused', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({
      sessions: { [SESSION_ID]: baseSession() },
      platformConfig: { takeRateBps: 250, insuranceBps: 50, subsidyAtomic: 0n, paused: true },
    });
    const r = await verifyPayment(input(basePayload()), backend, env);
    assert.equal(r.invalidReason, 'platform_paused');
  });

  it('rejects invalid signature', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({ sessions: { [SESSION_ID]: baseSession() } });
    const r = await verifyPayment(
      input(basePayload({ signature: 'not-valid' })),
      backend,
      env,
    );
    assert.equal(r.invalidReason, 'invalid_signature');
  });

  it('rejects missing session', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend();
    const r = await verifyPayment(input(basePayload()), backend, env);
    assert.equal(r.invalidReason, 'session_not_found');
  });

  it('rejects inactive session', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({
      sessions: { [SESSION_ID]: baseSession({ active: false }) },
    });
    const r = await verifyPayment(input(basePayload()), backend, env);
    assert.equal(r.invalidReason, 'session_inactive');
  });

  it('rejects session owned by another address', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({
      sessions: { [SESSION_ID]: baseSession({ ownerAddress: '0xother' }) },
    });
    const r = await verifyPayment(input(basePayload()), backend, env);
    assert.equal(r.invalidReason, 'session_inactive');
  });

  it('rejects insufficient balance', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({
      sessions: { [SESSION_ID]: baseSession({ balanceAtomic: 500n }) },
    });
    const r = await verifyPayment(input(basePayload()), backend, env);
    assert.equal(r.invalidReason, 'insufficient_balance');
  });

  it('rejects amount over per-call cap', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({
      sessions: { [SESSION_ID]: baseSession({ perCallCapAtomic: 500n }) },
    });
    const r = await verifyPayment(input(basePayload()), backend, env);
    assert.equal(r.invalidReason, 'per_call_cap_exceeded');
  });

  it('rejects amount that pushes over per-day cap', async () => {
    const env = envForTests();
    const sess = baseSession({
      perDayCapAtomic: 1_500_000n,
      todaySpentAtomic: 1_000_000n,
      todayEpochDay: Math.floor(Date.parse('2025-01-01') / 86_400_000),
    });
    const backend = createInMemorySuiBackend({
      sessions: { [SESSION_ID]: sess },
      initialNowMs: Date.parse('2025-01-01T12:00:00Z'),
    });
    const r = await verifyPayment(input(basePayload()), backend, env);
    assert.equal(r.invalidReason, 'per_day_cap_exceeded');
  });

  it('resets per-day spend at midnight', async () => {
    const env = envForTests();
    const sess = baseSession({
      perDayCapAtomic: 1_500_000n,
      todaySpentAtomic: 1_400_000n,
      todayEpochDay: Math.floor(Date.parse('2025-01-01') / 86_400_000),
    });
    const backend = createInMemorySuiBackend({
      sessions: { [SESSION_ID]: sess },
      initialNowMs: Date.parse('2025-01-02T12:00:00Z'),
    });
    const r = await verifyPayment(input(basePayload()), backend, env);
    assert.equal(r.isValid, true);
  });

  it('rejects server not in scoped set', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({
      sessions: {
        [SESSION_ID]: baseSession({ scopedServerObjectIds: ['0xother'] }),
      },
    });
    const r = await verifyPayment(input(basePayload()), backend, env);
    assert.equal(r.invalidReason, 'server_not_authorized');
  });

  it('allows server in scoped set', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({
      sessions: {
        [SESSION_ID]: baseSession({ scopedServerObjectIds: [SERVER_ID, '0xother'] }),
      },
    });
    const r = await verifyPayment(input(basePayload()), backend, env);
    assert.equal(r.isValid, true);
  });

  it('rejects expired session', async () => {
    const env = envForTests();
    const backend = createInMemorySuiBackend({
      sessions: {
        [SESSION_ID]: baseSession({ expiresAtMs: 1 }),
      },
      initialNowMs: 1_000_000,
    });
    const r = await verifyPayment(input(basePayload()), backend, env);
    assert.equal(r.invalidReason, 'session_inactive');
  });
});

describe('canonicalMessage', () => {
  it('is deterministic across equal details', () => {
    const a = canonicalMessage(detailsToWire(baseDetails()));
    const b = canonicalMessage(detailsToWire(baseDetails()));
    assert.equal(a, b);
  });

  it('changes when any field changes', () => {
    const base = canonicalMessage(detailsToWire(baseDetails()));
    const alt = canonicalMessage(detailsToWire(baseDetails({ amountAtomic: 999n })));
    assert.notEqual(base, alt);
  });
});
