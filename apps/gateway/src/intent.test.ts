import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateIntent, type IntentStore, type ResolvedIntent } from './intent.js';
import { GatewayError } from './errors.js';

const NOW = 1_700_000_100_000;
const DAY = Math.floor(NOW / 86_400_000);

function baseIntent(over: Partial<ResolvedIntent> = {}): ResolvedIntent {
  return {
    intentObjectId: '0xintent',
    agentAddress: '0xowner',
    dailyCapAtomic: 0n,
    perCallCapAtomic: 0n,
    serverObjectIds: [],
    allowedCategories: [],
    todaySpentAtomic: 0n,
    todayEpochDay: DAY,
    expiresAtMs: 0,
    revoked: false,
    ...over,
  };
}

function storeOf(i: ResolvedIntent | null): IntentStore {
  return { resolveIntent: async () => i };
}

const okInput = {
  intentObjectId: '0xintent',
  category: 'intelligence',
  callerAddress: '0xowner',
  serverObjectId: '0xserver',
  chargeAtomic: 5_000n,
  nowMs: NOW,
};

async function expectCode(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (e: unknown) => e instanceof GatewayError && e.code === code);
}

test('valid intent resolves and returns the intent', async () => {
  const r = await validateIntent(storeOf(baseIntent()), okInput);
  assert.equal(r.intentObjectId, '0xintent');
});

test('unknown intent → intent_not_found', async () => {
  await expectCode(validateIntent(storeOf(null), okInput), 'intent_not_found');
});

test('revoked intent → intent_revoked', async () => {
  await expectCode(
    validateIntent(storeOf(baseIntent({ revoked: true })), okInput),
    'intent_revoked',
  );
});

test('expired intent → intent_expired', async () => {
  await expectCode(
    validateIntent(storeOf(baseIntent({ expiresAtMs: NOW - 1 })), okInput),
    'intent_expired',
  );
});

test('expiresAtMs=0 never expires', async () => {
  const r = await validateIntent(storeOf(baseIntent({ expiresAtMs: 0 })), okInput);
  assert.ok(r);
});

test('agent != caller → intent_agent_mismatch', async () => {
  await expectCode(
    validateIntent(storeOf(baseIntent({ agentAddress: '0xother' })), okInput),
    'intent_agent_mismatch',
  );
});

test('server out of scope → intent_scope_mismatch', async () => {
  await expectCode(
    validateIntent(storeOf(baseIntent({ serverObjectIds: ['0xelse'] })), okInput),
    'intent_scope_mismatch',
  );
});

test('server in scope passes', async () => {
  const r = await validateIntent(
    storeOf(baseIntent({ serverObjectIds: ['0xserver'] })),
    okInput,
  );
  assert.ok(r);
});

test('category not allowed → intent_category_not_allowed', async () => {
  await expectCode(
    validateIntent(storeOf(baseIntent({ allowedCategories: ['data'] })), okInput),
    'intent_category_not_allowed',
  );
});

test('category allowed passes', async () => {
  const r = await validateIntent(
    storeOf(baseIntent({ allowedCategories: ['intelligence', 'data'] })),
    okInput,
  );
  assert.ok(r);
});

test('per-call cap exceeded → intent_per_call_cap_exceeded', async () => {
  await expectCode(
    validateIntent(storeOf(baseIntent({ perCallCapAtomic: 1_000n })), okInput),
    'intent_per_call_cap_exceeded',
  );
});

test('daily cap exceeded (same epoch day, prior spend) → intent_daily_cap_exceeded', async () => {
  await expectCode(
    validateIntent(
      storeOf(
        baseIntent({ dailyCapAtomic: 6_000n, todaySpentAtomic: 5_000n, todayEpochDay: DAY }),
      ),
      okInput,
    ),
    'intent_daily_cap_exceeded',
  );
});

test('daily cap: prior spend from a previous day is ignored', async () => {
  const r = await validateIntent(
    storeOf(
      baseIntent({ dailyCapAtomic: 6_000n, todaySpentAtomic: 9_999n, todayEpochDay: DAY - 1 }),
    ),
    okInput,
  );
  assert.ok(r);
});

test('free-tier (chargeAtomic=0) bypasses caps', async () => {
  const r = await validateIntent(
    storeOf(baseIntent({ perCallCapAtomic: 1n, dailyCapAtomic: 1n, todaySpentAtomic: 9n })),
    { ...okInput, chargeAtomic: 0n },
  );
  assert.ok(r);
});
