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
  attest(input: AttestInput): Promise<{ digest: string }>;
}

export interface OracleRunResult {
  windowStartMs: number;
  windowEndMs: number;
  serversMeasured: number;
  attestationsSubmitted: number;
  failures: { serverObjectId: string; error: string }[];
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
  let submitted = 0;
  for (const q of qualities) {
    try {
      await chain.attest({
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
  };
}
