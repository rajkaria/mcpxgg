import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { GasStation } from './gas-station.js';

describe('GasStation', () => {
  it('allows up to the per-minute cap, then rate-limits', () => {
    let now = 1_000_000;
    const gs = new GasStation(
      { ratePerMinute: 3, dailyBudgetMist: 1_000_000_000n },
      () => now,
    );
    for (let i = 0; i < 3; i++) {
      assert.equal(gs.check().allowed, true);
      gs.record(0n);
      now += 100;
    }
    const blocked = gs.check();
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.reason, 'rate_limited');
    assert.ok((blocked.retryAfterMs ?? 0) > 0);
  });

  it('lets the rate window slide', () => {
    let now = 1_000_000;
    const gs = new GasStation({ ratePerMinute: 2, dailyBudgetMist: 1n }, () => now);
    gs.record(0n);
    gs.record(0n);
    assert.equal(gs.check().allowed, false);
    now += 61_000;
    assert.equal(gs.check().allowed, true);
  });

  it('rolls the daily budget at UTC midnight', () => {
    let now = 86_400_000 * 100; // exact UTC day boundary
    const gs = new GasStation({ ratePerMinute: 60, dailyBudgetMist: 100n }, () => now);
    gs.record(60n);
    gs.record(40n);
    assert.equal(gs.snapshot().spentTodayMist, 100n);
    assert.equal(gs.check().allowed, false); // exhausted

    now += 86_400_000;
    assert.equal(gs.check().allowed, true);
    assert.equal(gs.snapshot().spentTodayMist, 0n);
  });

  it('reports remaining budget in snapshot', () => {
    const gs = new GasStation({ ratePerMinute: 60, dailyBudgetMist: 500n });
    gs.record(123n);
    const snap = gs.snapshot();
    assert.equal(snap.spentTodayMist, 123n);
    assert.equal(snap.rateUsed, 1);
  });
});
