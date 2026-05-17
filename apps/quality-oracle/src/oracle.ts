/**
 * S6-T18 — quality oracle compute core.
 *
 * Every 6h the oracle computes, per server, over the *prior closed*
 * UTC-anchored 6h window (floor(now/6h)·6h − 6h .. floor(now/6h)·6h):
 *
 *   uptime%       — successful calls / total calls (a call that returned at
 *                   all counts toward "up"; a server with zero calls in the
 *                   window is not attested — no signal).
 *   p95 latency   — 95th percentile of observed latency_ms (nearest-rank).
 *   error_rate%   — errored calls / total calls.
 *   sample_count  — total calls in the window.
 *
 * Composite score (documented & locked):
 *
 *   score = 0.50·uptime
 *         + 0.30·(1 − error_rate)
 *         + 0.20·latency_score
 *
 *   latency_score = clamp(1 − p95_ms / LATENCY_CEILING_MS, 0, 1)
 *
 * Rationale: availability dominates (a down server is worthless), correctness
 * is next (wrong answers erode trust faster than slow ones), latency is the
 * tiebreaker. LATENCY_CEILING_MS = 2000: a p95 ≥ 2s scores 0 on the latency
 * term, a p95 of 0 scores 1, linear between. All terms are fractions in
 * [0,1]; the final score is ×100 (basis-point-of-100) clamped to [0,10000]
 * to match the Move `u32 score_x100 <= 10_000` invariant.
 *
 * Everything here is pure: `computeServerQuality` is input→output with no
 * I/O. `runQualityOracle` is the only side-effecting fn and takes an
 * injected store + injected chain client, so tests run fully offline.
 */

/** p95 latency ceiling: at/above this, the latency term contributes 0. */
export const LATENCY_CEILING_MS = 2000;

export const WEIGHTS = { uptime: 0.5, correctness: 0.3, latency: 0.2 } as const;

/** Six hours in ms — the oracle (and abuse scan) window length. */
export const WINDOW_MS = 6 * 60 * 60 * 1000;

/** One mirrored request_log row, as the store yields it. */
export interface CallSample {
  serverObjectId: string;
  /** 'success' counts as up + correct; anything else is an error. */
  status: 'success' | 'error' | 'timeout' | 'refunded';
  /** Observed latency in ms. Null rows are excluded from the p95 only. */
  latencyMs: number | null;
}

export interface ServerQuality {
  serverObjectId: string;
  /** 0..10000 */
  scoreX100: number;
  /** 0..10000 */
  uptimeX100: number;
  p95LatencyMs: number;
  /** 0..10000 */
  errorRateX100: number;
  sampleCount: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Nearest-rank p95 over a copy of the values. 0 for an empty input. */
export function p95(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  // Nearest-rank: ceil(0.95·n), 1-indexed.
  const rank = Math.ceil(0.95 * sorted.length);
  return sorted[Math.min(rank, sorted.length) - 1] ?? 0;
}

/**
 * Pure: fold a server's samples into its quality metrics. Returns null when
 * there are no samples (nothing to attest — emitting a 0 would lie).
 */
export function computeServerQuality(
  serverObjectId: string,
  samples: readonly CallSample[],
): ServerQuality | null {
  if (samples.length === 0) return null;
  const total = samples.length;
  let success = 0;
  const latencies: number[] = [];
  for (const s of samples) {
    if (s.status === 'success') success += 1;
    if (s.latencyMs !== null && Number.isFinite(s.latencyMs)) latencies.push(s.latencyMs);
  }
  const errors = total - success;

  const uptime = success / total; // [0,1]
  const errorRate = errors / total; // [0,1]
  const p95Ms = p95(latencies);
  const latencyScore = clamp(1 - p95Ms / LATENCY_CEILING_MS, 0, 1);

  const score =
    WEIGHTS.uptime * uptime +
    WEIGHTS.correctness * (1 - errorRate) +
    WEIGHTS.latency * latencyScore;

  const toX100 = (frac: number) => clamp(Math.round(frac * 10_000), 0, 10_000);

  return {
    serverObjectId,
    scoreX100: toX100(score),
    uptimeX100: toX100(uptime),
    p95LatencyMs: Math.round(p95Ms),
    errorRateX100: toX100(errorRate),
    sampleCount: total,
  };
}

/**
 * Group flat samples by server and compute each server's quality. Pure.
 * Servers with no samples are omitted. Output is sorted by serverObjectId
 * for deterministic attest ordering.
 */
export function computeAllServerQuality(samples: readonly CallSample[]): ServerQuality[] {
  const byServer = new Map<string, CallSample[]>();
  for (const s of samples) {
    const arr = byServer.get(s.serverObjectId);
    if (arr) arr.push(s);
    else byServer.set(s.serverObjectId, [s]);
  }
  const out: ServerQuality[] = [];
  for (const [serverObjectId, group] of byServer) {
    const q = computeServerQuality(serverObjectId, group);
    if (q) out.push(q);
  }
  return out.sort((a, b) => (a.serverObjectId < b.serverObjectId ? -1 : 1));
}

/**
 * The most recent *closed* 6h window ending at or before `nowMs`,
 * UTC-anchored at floor(now/6h)·6h.
 */
export function priorClosedWindow(nowMs: number): { startMs: number; endMs: number } {
  const boundary = Math.floor(nowMs / WINDOW_MS) * WINDOW_MS;
  return { startMs: boundary - WINDOW_MS, endMs: boundary };
}

// ─── Side-effecting orchestration (injected deps) ────────────────────────

/** Read-only view of the indexed request_log the oracle measures. */
export interface QualityStore {
  /** All call samples in [windowStartMs, windowEndMs). */
  getCallSamples(windowStartMs: number, windowEndMs: number): Promise<CallSample[]>;
}

export interface AttestInput {
  serverObjectId: string;
  scoreX100: number;
  uptimeX100: number;
  p95LatencyMs: number;
  errorRateX100: number;
  sampleCount: number;
  windowStartMs: number;
  windowEndMs: number;
}

/**
 * Submits one on-chain attestation. The production impl builds the PTB via
 * `@mcpxgg/chain` `buildAttestQualityTx` and signs it through the chain
 * package's `signAndExecuteBase64Tx` (never raw @mysten/sui). Injected so
 * tests assert the calls without a node.
 */
export interface QualityChainClient {
  /**
   * Submits the attestation and returns the digest plus the on-chain object
   * id of the shared `QualityAttestation` it created. The slash pass needs
   * that id: `staking::slash` now aborts unless handed a fresh attestation
   * proving the breach (security hardening). `null` if the chain returned no
   * such created object (treated as "no proof available this tick").
   */
  attest(input: AttestInput): Promise<{ digest: string; attestationObjectId: string | null }>;
}

export interface OracleRunResult {
  windowStartMs: number;
  windowEndMs: number;
  serversMeasured: number;
  attestationsSubmitted: number;
  failures: { serverObjectId: string; error: string }[];
  /**
   * serverObjectId → freshly-created on-chain `QualityAttestation` object id,
   * for the attestations this pass *successfully* submitted this tick. The
   * SLA-slash pass consumes this to prove a breach on-chain (an attestation
   * that returned no created object id is omitted — there is no usable proof).
   */
  attestationsByServer: Map<string, string>;
}

/**
 * One oracle pass over a closed window: read → compute → attest each server.
 * Per-server attest failures are collected (one bad server must not block
 * the rest) and surfaced in the result. Pure-ish: all effects via injected
 * `store` + `chain`.
 */
export async function runQualityOracle(
  store: QualityStore,
  chain: QualityChainClient,
  windowStartMs: number,
  windowEndMs: number,
): Promise<OracleRunResult> {
  const samples = await store.getCallSamples(windowStartMs, windowEndMs);
  const qualities = computeAllServerQuality(samples);
  const failures: { serverObjectId: string; error: string }[] = [];
  const attestationsByServer = new Map<string, string>();
  let submitted = 0;
  for (const q of qualities) {
    try {
      const r = await chain.attest({
        serverObjectId: q.serverObjectId,
        scoreX100: q.scoreX100,
        uptimeX100: q.uptimeX100,
        p95LatencyMs: q.p95LatencyMs,
        errorRateX100: q.errorRateX100,
        sampleCount: q.sampleCount,
        windowStartMs,
        windowEndMs,
      });
      submitted += 1;
      // Only record an attestation id when the chain actually created one;
      // without it the slash pass has no on-chain proof to reference.
      if (r.attestationObjectId !== null) {
        attestationsByServer.set(q.serverObjectId, r.attestationObjectId);
      }
    } catch (e) {
      failures.push({ serverObjectId: q.serverObjectId, error: String(e) });
    }
  }
  return {
    windowStartMs,
    windowEndMs,
    serversMeasured: qualities.length,
    attestationsSubmitted: submitted,
    failures,
    attestationsByServer,
  };
}

// ─── S7-T09: SLA staking auto-slash orchestration ────────────────────────

import {
  evaluateSla,
  nextBreachStreak,
  slashAmountAtomic,
  slashReason,
  type StakedServer,
} from './sla.js';

export type { StakedServer } from './sla.js';

/** Read-only view of the indexer `stakes`/`stake_slashes` mirror. */
export interface StakeStore {
  /**
   * All currently-active (un-fully-slashed) staked servers with the stake
   * amount net of prior slashes. The store derives `remainingStakeAtomic`
   * from `stakes.amount_atomic` minus the sum of `stake_slashes.amount_atomic`
   * for that stake.
   */
  listActiveStakes(): Promise<StakedServer[]>;
}

/**
 * Durable per-stake breach streak. The oracle is the only writer; the streak
 * is keyed by stakeObjectId and must survive process restarts so the ≥2
 * consecutive-window rule holds across the 6h cadence.
 */
export interface BreachStreakStore {
  /** Consecutive in-breach windows recorded so far (0 if unseen). */
  getStreak(stakeObjectId: string): Promise<number>;
  /** Persist the new streak (0 clears it). */
  setStreak(stakeObjectId: string, consecutiveBreaches: number): Promise<void>;
}

export interface SlashInput {
  stakeObjectId: string;
  serverObjectId: string;
  /**
   * Fresh on-chain `QualityAttestation` object id (created this tick by the
   * quality-attest pass for this same server) that proves the SLA breach.
   * `staking::slash` aborts without it — an OracleCap alone can no longer
   * slash (E_ATTESTATION_SERVER_MISMATCH / E_NO_SLA_BREACH / E_STALE_ATTESTATION).
   */
  attestationObjectId: string;
  amountAtomic: bigint;
  reason: string;
}

/**
 * Submits one on-chain slash. The production impl builds the PTB via
 * `@mcpxgg/chain` `buildSlashStakeTx` (oracle holds the OracleCap) and signs
 * it through `signAndExecuteBase64Tx` — the exact same signer/cap path the
 * quality attestation uses. Injected so tests assert without a node.
 */
export interface SlashChainClient {
  slash(input: SlashInput): Promise<{ digest: string }>;
}

export interface SlaSlashResult {
  windowStartMs: number;
  windowEndMs: number;
  stakesEvaluated: number;
  inBreach: number;
  slashesSubmitted: number;
  slashedAtomicTotal: bigint;
  /**
   * Breached stakes that would have been slashed this tick but were skipped
   * because no fresh `QualityAttestation` exists for that server (attest
   * failed/absent). The streak is preserved so it retries next window.
   */
  skippedNoAttestation: number;
  failures: { stakeObjectId: string; error: string }[];
}

/**
 * One SLA-slashing pass over the same closed window the quality oracle
 * measured. For each active stake: measure its window uptime from the call
 * samples, evaluate against its committed SLA, advance its persisted breach
 * streak, and — when the streak crosses ≥2 consecutive in-breach windows —
 * build+sign a proportional slash. Pure-ish: all effects via injected deps.
 *
 * A per-stake failure (mirror gap, tx revert) is collected and does not block
 * the rest; the streak is only advanced *after* a successful slash submission
 * for the slashing case so a failed slash is retried next window rather than
 * silently dropped.
 *
 * `attestationsByServer` is the map the quality-attest pass produced *this same
 * tick* (serverObjectId → fresh QualityAttestation object id). `staking::slash`
 * now aborts without a fresh proving attestation, so when a breached stake's
 * server has no attestation id this tick we SKIP the slash entirely (an
 * unprovable slash would just abort on-chain) and preserve the streak so it
 * retries next window — mirroring the existing "failed slash → streak not
 * advanced" semantics.
 */
export async function runSlaSlashing(
  stakeStore: StakeStore,
  streakStore: BreachStreakStore,
  chain: SlashChainClient,
  samples: readonly CallSample[],
  windowStartMs: number,
  windowEndMs: number,
  attestationsByServer: ReadonlyMap<string, string>,
): Promise<SlaSlashResult> {
  const stakes = await stakeStore.listActiveStakes();
  // Reuse the same pure quality fold for per-server uptime/sample-count.
  const quality = computeAllServerQuality(samples);
  const qByServer = new Map(quality.map((q) => [q.serverObjectId, q]));

  const failures: { stakeObjectId: string; error: string }[] = [];
  let inBreach = 0;
  let slashesSubmitted = 0;
  let slashedTotal = 0n;
  let skippedNoAttestation = 0;

  for (const stake of stakes) {
    try {
      const q = qByServer.get(stake.serverObjectId);
      const windowUptimeX100 = q?.uptimeX100 ?? 0;
      const windowSampleCount = q?.sampleCount ?? 0;
      const evaluation = evaluateSla(stake, windowUptimeX100, windowSampleCount);
      if (evaluation.inBreach) inBreach += 1;

      const prev = await streakStore.getStreak(stake.stakeObjectId);
      const { consecutiveBreaches, shouldSlash } = nextBreachStreak(
        prev,
        evaluation,
      );

      if (!shouldSlash) {
        // No-signal windows leave the streak (and store) unchanged.
        if (consecutiveBreaches !== prev) {
          await streakStore.setStreak(
            stake.stakeObjectId,
            consecutiveBreaches,
          );
        }
        continue;
      }

      const amount = slashAmountAtomic(
        evaluation,
        stake.remainingStakeAtomic,
      );
      if (amount <= 0n) {
        // Breached but nothing left to slash — keep the streak, no tx.
        await streakStore.setStreak(stake.stakeObjectId, consecutiveBreaches);
        continue;
      }

      const attestationObjectId = attestationsByServer.get(
        stake.serverObjectId,
      );
      if (attestationObjectId === undefined) {
        // No fresh on-chain attestation proving this breach (attest failed or
        // produced no object this tick). `staking::slash` would abort, so
        // don't even attempt it. Preserve the streak (it already crossed the
        // threshold) so the slash is retried next window once an attestation
        // exists — same semantics as a failed slash tx.
        skippedNoAttestation += 1;
        failures.push({
          stakeObjectId: stake.stakeObjectId,
          error:
            `skipped: no fresh QualityAttestation for server ` +
            `${stake.serverObjectId} this tick — slash would abort on-chain`,
        });
        await streakStore.setStreak(stake.stakeObjectId, consecutiveBreaches);
        continue;
      }

      await chain.slash({
        stakeObjectId: stake.stakeObjectId,
        serverObjectId: stake.serverObjectId,
        attestationObjectId,
        amountAtomic: amount,
        reason: slashReason(evaluation, consecutiveBreaches, windowEndMs),
      });
      // Slash landed — persist the streak so a repeat-offender keeps
      // accumulating and reset only happens on a genuinely compliant window.
      await streakStore.setStreak(stake.stakeObjectId, consecutiveBreaches);
      slashesSubmitted += 1;
      slashedTotal += amount;
    } catch (e) {
      failures.push({ stakeObjectId: stake.stakeObjectId, error: String(e) });
    }
  }

  return {
    windowStartMs,
    windowEndMs,
    stakesEvaluated: stakes.length,
    inBreach,
    slashesSubmitted,
    slashedAtomicTotal: slashedTotal,
    skippedNoAttestation,
    failures,
  };
}
