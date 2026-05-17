import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  detectAbuse,
  populationStats,
  priorClosedWindow,
  runAbuseScan,
  WINDOW_MS,
  type AbuseStore,
} from './abuse.js';
import type { AbuseFlagInsert, AccountAggregate } from './storage/storage.js';

const W_START = 1_700_000_000_000;
const W_END = W_START + WINDOW_MS;

function agg(addr: string, callVolume: number, spendAtomic: bigint): AccountAggregate {
  return { accountAddress: addr, callVolume, spendAtomic };
}

describe('populationStats', () => {
  it('returns zeroes for empty input', () => {
    const s = populationStats([]);
    assert.equal(s.n, 0);
    assert.equal(s.stddev, 0);
  });

  it('stddev is 0 for n<2 (no population spread)', () => {
    assert.equal(populationStats([42]).stddev, 0);
  });

  it('uses sample stddev (n-1)', () => {
    // [2,4,4,4,5,5,7,9] sample stddev = 2.138... (n-1 = 7)
    const s = populationStats([2, 4, 4, 4, 5, 5, 7, 9]);
    assert.equal(s.mean, 5);
    assert.ok(Math.abs(s.stddev - 2.13808993529939) < 1e-9);
  });
});

describe('detectAbuse', () => {
  it('flags nothing with < 2 accounts', () => {
    assert.deepEqual(detectAbuse([agg('0xa', 999, 999n)], W_START, W_END), []);
  });

  it('flags nothing when the population has no spread', () => {
    const flat = [agg('0xa', 10, 5n), agg('0xb', 10, 5n), agg('0xc', 10, 5n)];
    assert.deepEqual(detectAbuse(flat, W_START, W_END), []);
  });

  it('flags an account whose call volume exceeds mean + 3 sigma', () => {
    // A realistic population: 50 normal accounts tightly clustered near 10,
    // one whale far out. (A single extreme outlier in a *tiny* population
    // can't be 3σ from a mean/σ it itself dominates — that's a real property
    // of the heuristic, not a bug; the population must be big enough.)
    const aggs: AccountAggregate[] = [];
    for (let i = 0; i < 50; i++) aggs.push(agg(`0x${i}`, 9 + (i % 3), 1_000n));
    aggs.push(agg('0xwhale', 5_000, 1_000n));
    const flags = detectAbuse(aggs, W_START, W_END);
    const vol = flags.filter((f) => f.metric === 'call_volume');
    assert.equal(vol.length, 1);
    assert.equal(vol[0]?.accountAddress, '0xwhale');
    assert.ok((vol[0]?.zscore ?? 0) >= 3);
    assert.equal(vol[0]?.windowStartMs, W_START);
    assert.equal(vol[0]?.windowEndMs, W_END);
  });

  it('flags spend independently from volume', () => {
    const aggs: AccountAggregate[] = [];
    for (let i = 0; i < 50; i++) aggs.push(agg(`0x${i}`, 10, 1_000n));
    aggs.push(agg('0xspender', 10, 9_000_000n));
    const flags = detectAbuse(aggs, W_START, W_END);
    assert.equal(flags.length, 1);
    assert.equal(flags[0]?.metric, 'spend_atomic');
    assert.equal(flags[0]?.accountAddress, '0xspender');
  });

  it('can flag one account on both metrics', () => {
    const aggs: AccountAggregate[] = [];
    for (let i = 0; i < 50; i++) aggs.push(agg(`0x${i}`, 10, 1_000n));
    aggs.push(agg('0xboth', 8_000, 9_000_000n));
    const flags = detectAbuse(aggs, W_START, W_END);
    const metrics = flags.filter((f) => f.accountAddress === '0xboth').map((f) => f.metric).sort();
    assert.deepEqual(metrics, ['call_volume', 'spend_atomic']);
  });

  it('respects a custom sigma', () => {
    const aggs = [agg('0xa', 10, 1n), agg('0xb', 12, 1n), agg('0xc', 20, 1n)];
    // At sigma=3 nothing trips; at sigma=1 the high one should.
    assert.equal(detectAbuse(aggs, W_START, W_END, 3).length, 0);
    assert.ok(detectAbuse(aggs, W_START, W_END, 1).length >= 1);
  });
});

describe('priorClosedWindow', () => {
  it('returns the 6h window before the floor boundary, UTC-anchored', () => {
    const boundary = 5 * WINDOW_MS; // exact boundary
    const w = priorClosedWindow(boundary + 123_456);
    assert.equal(w.endMs, boundary);
    assert.equal(w.startMs, boundary - WINDOW_MS);
  });

  it('is deterministic for any time within the same window', () => {
    const a = priorClosedWindow(10 * WINDOW_MS + 1);
    const b = priorClosedWindow(11 * WINDOW_MS - 1);
    assert.deepEqual(a, b);
  });
});

describe('runAbuseScan', () => {
  it('reads aggregates, writes one flag per breach, returns a summary', async () => {
    const written: AbuseFlagInsert[] = [];
    const aggs: AccountAggregate[] = [];
    for (let i = 0; i < 50; i++) aggs.push(agg(`0x${i}`, 10, 1_000n));
    aggs.push(agg('0xwhale', 5_000, 1_000n));

    const store: AbuseStore = {
      async getAccountAggregates(s, e) {
        assert.equal(s, W_START);
        assert.equal(e, W_END);
        return aggs;
      },
      async insertAbuseFlag(f) {
        written.push(f);
      },
    };

    const res = await runAbuseScan(store, W_START, W_END);
    assert.equal(res.accountsAnalyzed, 51);
    assert.equal(res.flagsWritten, 1);
    assert.equal(written.length, 1);
    assert.equal(written[0]?.accountAddress, '0xwhale');
  });

  it('writes nothing when there are no anomalies', async () => {
    const store: AbuseStore = {
      async getAccountAggregates() {
        return [agg('0xa', 10, 5n), agg('0xb', 11, 6n), agg('0xc', 9, 4n)];
      },
      async insertAbuseFlag() {
        throw new Error('should not write');
      },
    };
    const res = await runAbuseScan(store, W_START, W_END);
    assert.equal(res.flagsWritten, 0);
  });
});
