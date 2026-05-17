/**
 * S7-T09 — SLA staking compliance + auto-slash.
 *
 * A developer who has posted a `mcpx::staking::ServerStake` commits to an SLA
 * uptime tier (95 → 9500, 99 → 9900, 99.9 → 9990, all ×100). Every oracle
 * window (the same closed 6h cadence the quality oracle already runs) we
 * measure the staked server's actual uptime over that window and compare it to
 * its committed tier.
 *
 * Hysteresis: a single bad window can be noise (a deploy, a transient upstream
 * outage). We only slash once a stake has breached its committed SLA for
 * **≥2 consecutive measured windows** — matching the SPRINTS S7-T09 wording
 * ("threshold breached for ≥2 windows"). A window with zero calls is *not*
 * counted as a breach and *does not reset* the streak (no signal — neither
 * compliant nor in breach), so a quiet server can't be slashed for silence and
 * a flaky one can't dodge a slash by going dark for one window.
 *
 * ── Slash formula (documented & locked) ─────────────────────────────────────
 *
 *   shortfallFraction = (committedUptimeX100 − actualUptimeX100) / committedUptimeX100
 *                       clamped to [0, 1]
 *
 *   slashAtomic = round( remainingStakeAtomic × shortfallFraction )
 *                 then clamped to [0, remainingStakeAtomic]
 *
 * Rationale: the penalty is *proportional to how badly the commitment was
 * missed, relative to what was promised*. A 99% server that delivered 99% is
 * never slashed (shortfall 0). A 99% server that delivered ~0% loses
 * essentially its whole stake (shortfall → 1). A 99% server that delivered 95%
 * loses ≈ (9900−9500)/9900 ≈ 4.0% of its remaining stake per slash event.
 * Normalising by the *committed* tier (not by 100%) makes the penalty scale
 * with the strength of the promise: missing a 99.9% promise by a given
 * absolute amount hurts slightly more than missing a 95% promise by the same
 * absolute amount, which is the desired incentive. The amount is capped at the
 * remaining stake so repeated slashes monotonically drain (never over-draw)
 * the stake; the Move `slash` entry also enforces this on-chain.
 *
 * Everything in this file is pure (input → output, no I/O). The orchestration
 * that reads the mirror, holds streak state, and signs the slash PTB lives in
 * `runSlaSlashing` (oracle.ts) with injected deps so tests run fully offline.
 */

/** One staked server as the mirror (the indexer `stakes` table) yields it. */
export interface StakedServer {
  stakeObjectId: string;
  serverObjectId: string;
  /** Committed SLA uptime ×100: 9500 | 9900 | 9990. */
  slaUptimeX100: number;
  /** Stake remaining after any prior slashes, in USDsui atomic (6dp). */
  remainingStakeAtomic: bigint;
}

/** Per-stake SLA evaluation for one closed window. */
export interface SlaEvaluation {
  stakeObjectId: string;
  serverObjectId: string;
  slaUptimeX100: number;
  /** Actual uptime ×100 this window, or null when the window had no calls. */
  actualUptimeX100: number | null;
  /** True iff actualUptimeX100 is non-null and < slaUptimeX100. */
  inBreach: boolean;
  /** (committed − actual)/committed clamped [0,1]; 0 when not in breach. */
  shortfallFraction: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Pure: evaluate one staked server against its committed SLA for a window
 * given that window's measured uptime (×100) and sample count.
 *
 * `sampleCount === 0` → no signal: not in breach, shortfall 0,
 * `actualUptimeX100` null. Callers must treat that as "streak unchanged".
 */
export function evaluateSla(
  stake: StakedServer,
  windowUptimeX100: number,
  windowSampleCount: number,
): SlaEvaluation {
  if (windowSampleCount <= 0) {
    return {
      stakeObjectId: stake.stakeObjectId,
      serverObjectId: stake.serverObjectId,
      slaUptimeX100: stake.slaUptimeX100,
      actualUptimeX100: null,
      inBreach: false,
      shortfallFraction: 0,
    };
  }
  const inBreach = windowUptimeX100 < stake.slaUptimeX100;
  const shortfallFraction = inBreach
    ? clamp(
        (stake.slaUptimeX100 - windowUptimeX100) / stake.slaUptimeX100,
        0,
        1,
      )
    : 0;
  return {
    stakeObjectId: stake.stakeObjectId,
    serverObjectId: stake.serverObjectId,
    slaUptimeX100: stake.slaUptimeX100,
    actualUptimeX100: windowUptimeX100,
    inBreach,
    shortfallFraction,
  };
}

/**
 * Pure: the slash amount in USDsui atomic for a breaching evaluation, given
 * the stake's remaining balance. Returns 0n when not in breach or nothing is
 * left to slash. Proportional to the shortfall fraction, capped at remaining.
 */
export function slashAmountAtomic(
  evaluation: SlaEvaluation,
  remainingStakeAtomic: bigint,
): bigint {
  if (!evaluation.inBreach || remainingStakeAtomic <= 0n) return 0n;
  if (evaluation.shortfallFraction <= 0) return 0n;
  // bigint × fraction via a 1e6 fixed-point scale to avoid float on bigint.
  const SCALE = 1_000_000n;
  const fracScaled = BigInt(
    Math.round(clamp(evaluation.shortfallFraction, 0, 1) * 1_000_000),
  );
  const raw = (remainingStakeAtomic * fracScaled) / SCALE;
  return raw > remainingStakeAtomic ? remainingStakeAtomic : raw;
}

/** Number of consecutive in-breach windows that triggers a slash. */
export const BREACH_WINDOWS_TO_SLASH = 2;

/**
 * Pure streak transition. `prevConsecutiveBreaches` is the count *before* this
 * window. Rules:
 *   - in breach            → streak + 1
 *   - measured & compliant → streak reset to 0
 *   - no signal (null)     → streak unchanged
 * `shouldSlash` is true exactly when the new streak reaches the threshold AND
 * we just observed a breach this window (so we slash on the breaching window
 * that crosses the line, not on a later quiet window).
 */
export function nextBreachStreak(
  prevConsecutiveBreaches: number,
  evaluation: SlaEvaluation,
): { consecutiveBreaches: number; shouldSlash: boolean } {
  if (evaluation.actualUptimeX100 === null) {
    return {
      consecutiveBreaches: prevConsecutiveBreaches,
      shouldSlash: false,
    };
  }
  if (!evaluation.inBreach) {
    return { consecutiveBreaches: 0, shouldSlash: false };
  }
  const consecutiveBreaches = prevConsecutiveBreaches + 1;
  return {
    consecutiveBreaches,
    shouldSlash: consecutiveBreaches >= BREACH_WINDOWS_TO_SLASH,
  };
}

/** Human-readable slash reason embedded in the on-chain StakeSlashed event. */
export function slashReason(
  evaluation: SlaEvaluation,
  consecutiveBreaches: number,
  windowEndMs: number,
): string {
  const actual = evaluation.actualUptimeX100 ?? 0;
  return (
    `SLA breach: committed ${(evaluation.slaUptimeX100 / 100).toFixed(2)}% ` +
    `uptime, measured ${(actual / 100).toFixed(2)}% over ${consecutiveBreaches} ` +
    `consecutive windows (window end ${new Date(windowEndMs).toISOString()})`
  );
}
