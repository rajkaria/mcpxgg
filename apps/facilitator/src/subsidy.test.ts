import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SubsidyLedger } from './subsidy.js';

const MAY = Date.UTC(2026, 4, 17);
const JUNE = Date.UTC(2026, 5, 1);

test('one grant per address; second is refused', () => {
  const s = new SubsidyLedger({ perUserAtomic: 1_000_000n, monthlyBudgetAtomic: 10_000_000n });
  const a = s.request('0xabc', MAY);
  assert.equal(a.approved, true);
  assert.equal(a.amountAtomic, 1_000_000n);
  const b = s.request('0xabc', MAY);
  assert.equal(b.approved, false);
  assert.equal(b.reason, 'already_granted');
});

test('monthly budget caps grants and resets next month', () => {
  const s = new SubsidyLedger({ perUserAtomic: 1_000_000n, monthlyBudgetAtomic: 2_000_000n });
  assert.equal(s.request('0x1', MAY).approved, true);
  assert.equal(s.request('0x2', MAY).approved, true);
  const third = s.request('0x3', MAY);
  assert.equal(third.approved, false);
  assert.equal(third.reason, 'monthly_budget_exhausted');
  // New UTC month → budget resets.
  assert.equal(s.request('0x3', JUNE).approved, true);
});

test('snapshot reports spent vs budget for the current month', () => {
  const s = new SubsidyLedger({ perUserAtomic: 500_000n, monthlyBudgetAtomic: 5_000_000n });
  s.request('0xq', MAY);
  const snap = s.snapshot(MAY);
  assert.equal(snap.spentAtomic, 500_000n);
  assert.equal(snap.budgetAtomic, 5_000_000n);
});
