/**
 * S6-T26 — abuse detection heuristic.
 *
 * Pure compute over per-account aggregates: flag accounts whose call volume
 * OR spend in a closed window exceeds `mean + 3·stddev` of the population.
 * Three-sigma is the classic outlier gate (~0.13% of a normal tail), and
 * crucially it self-scales: a window where everyone is busy raises the bar,
 * so we flag *relative* anomalies, not just "high" accounts.
 *
 * The flag detection is a pure function (`detectAbuse`) so it unit-tests
 * fully offline. `runAbuseScan` wires it to an injected store — no network,
 * no db, no clock except the window passed in.
 *
 * Population stats use the *sample* standard deviation (n-1). With n < 2 the
 * stddev is undefined; we return no flags (can't establish a population).
 */

import type { AbuseFlagInsert, AccountAggregate } from './storage/storage.js';

/** Minimum z-score over the population mean to flag. */
export const ABUSE_SIGMA_THRESHOLD = 3;

/** A store the scan reads aggregates from and writes flags to. */
export interface AbuseStore {
  getAccountAggregates(windowStartMs: number, windowEndMs: number): Promise<AccountAggregate[]>;
  insertAbuseFlag(flag: AbuseFlagInsert): Promise<void>;
}

interface Stats {
  mean: number;
  /** Sample standard deviation (n-1). 0 when all values are identical. */
  stddev: number;
  /** Population size the stats were computed over. */
  n: number;
}

/** Sample mean + stddev (n-1). Pure. */
export function populationStats(values: number[]): Stats {
  const n = values.length;
  if (n === 0) return { mean: 0, stddev: 0, n: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  if (n < 2) return { mean, stddev: 0, n };
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  return { mean, stddev: Math.sqrt(variance), n };
}

/**
 * Pure: given per-account aggregates and the window, return the abuse flags
 * (one per (account, metric) that breaches the threshold). Deterministic,
 * input-only — no I/O.
 *
 * An account can be flagged on both metrics independently. When the
 * population stddev is 0 (all accounts identical, or n < 2) nothing is
 * flagged: there's no spread to be anomalous against.
 */
export function detectAbuse(
  aggregates: readonly AccountAggregate[],
  windowStartMs: number,
  windowEndMs: number,
  sigma: number = ABUSE_SIGMA_THRESHOLD,
): AbuseFlagInsert[] {
  if (aggregates.length < 2) return [];

  const volumes = aggregates.map((a) => a.callVolume);
  // Spend is bigint atomic units; cast to number for the z-score only. USDsui
  // is 6dp so realistic window spend stays well under 2^53 — fine for a
  // statistical ratio (we never settle money off this value).
  const spends = aggregates.map((a) => Number(a.spendAtomic));

  const volStats = populationStats(volumes);
  const spendStats = populationStats(spends);

  const flags: AbuseFlagInsert[] = [];
  for (const a of aggregates) {
    if (volStats.stddev > 0) {
      const z = (a.callVolume - volStats.mean) / volStats.stddev;
      if (z >= sigma) {
        flags.push({
          accountAddress: a.accountAddress,
          metric: 'call_volume',
          zscore: z,
          windowStartMs,
          windowEndMs,
        });
      }
    }
    if (spendStats.stddev > 0) {
      const z = (Number(a.spendAtomic) - spendStats.mean) / spendStats.stddev;
      if (z >= sigma) {
        flags.push({
          accountAddress: a.accountAddress,
          metric: 'spend_atomic',
          zscore: z,
          windowStartMs,
          windowEndMs,
        });
      }
    }
  }
  return flags;
}

export interface AbuseScanResult {
  windowStartMs: number;
  windowEndMs: number;
  accountsAnalyzed: number;
  flagsWritten: number;
}

/**
 * Read aggregates for the closed window, detect anomalies, persist flags.
 * Side-effecting only via the injected store — fully testable offline.
 */
export async function runAbuseScan(
  store: AbuseStore,
  windowStartMs: number,
  windowEndMs: number,
  sigma: number = ABUSE_SIGMA_THRESHOLD,
): Promise<AbuseScanResult> {
  const aggregates = await store.getAccountAggregates(windowStartMs, windowEndMs);
  const flags = detectAbuse(aggregates, windowStartMs, windowEndMs, sigma);
  for (const f of flags) {
    await store.insertAbuseFlag(f);
  }
  return {
    windowStartMs,
    windowEndMs,
    accountsAnalyzed: aggregates.length,
    flagsWritten: flags.length,
  };
}

/** Six hours in ms — the abuse scan + quality oracle window length. */
export const WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * The most recent *closed* UTC-anchored window ending at or before `nowMs`.
 * floor(now/6h)*6h is the boundary; the closed window is the 6h before it.
 */
export function priorClosedWindow(nowMs: number): { startMs: number; endMs: number } {
  const boundary = Math.floor(nowMs / WINDOW_MS) * WINDOW_MS;
  return { startMs: boundary - WINDOW_MS, endMs: boundary };
}
