/**
 * Platform economics constants. Source of truth: docs/DECISIONS.md ADR-004
 * (2.5% take rate — 0.5% insurance + 2.0% treasury, configurable on-chain via
 * `PlatformConfig`). These are the DEFAULTS for UI estimation only; the live
 * rate is read from the chain mirror (`platform_state.take_rate_bps`).
 */

/** Total platform take in basis points (250 = 2.5%). */
export const DEFAULT_TAKE_RATE_BPS = 250;
/** Insurance carve-out in basis points (50 = 0.5%). */
export const DEFAULT_INSURANCE_BPS = 50;
/** Treasury share in basis points (200 = 2.0%). */
export const DEFAULT_TREASURY_BPS = DEFAULT_TAKE_RATE_BPS - DEFAULT_INSURANCE_BPS;

/** Developer net fraction of gross (e.g. 0.975 at the 2.5% default). */
export function devNetFraction(takeRateBps = DEFAULT_TAKE_RATE_BPS): number {
  return 1 - takeRateBps / 10_000;
}
