/**
 * Sponsored-gas rate limiter. Wraps `submitSettle` so a single misbehaving
 * gateway or key compromise can't drain the gas tank.
 *
 * Two budgets, both enforced:
 *   1. requests-per-minute  — sliding window, in-memory
 *   2. daily SUI budget     — cumulative, in-memory, resets at UTC midnight
 *
 * Both are intentionally process-local. Multi-replica deployments either pin
 * a single facilitator or carry the budget in Redis (Sprint 4 hardening).
 */

import { ChainError } from './sui/types.js';

export interface GasStationLimits {
  ratePerMinute: number;
  dailyBudgetMist: bigint;
}

export interface GasStationCheck {
  allowed: boolean;
  reason?: 'rate_limited' | 'daily_budget_exhausted';
  retryAfterMs?: number;
}

export class GasStation {
  private readonly limits: GasStationLimits;
  private readonly nowMs: () => number;
  private requestTimestamps: number[] = [];
  private spentTodayMist = 0n;
  private currentUtcDay: number;

  constructor(limits: GasStationLimits, nowMs: () => number = () => Date.now()) {
    this.limits = limits;
    this.nowMs = nowMs;
    this.currentUtcDay = Math.floor(this.nowMs() / 86_400_000);
  }

  /** Returns whether the next settle attempt is allowed, without recording it. */
  check(): GasStationCheck {
    this.rollDailyWindow();
    this.trimRateWindow();
    if (this.requestTimestamps.length >= this.limits.ratePerMinute) {
      const oldest = this.requestTimestamps[0];
      const retryAfterMs = oldest === undefined ? 60_000 : 60_000 - (this.nowMs() - oldest);
      return { allowed: false, reason: 'rate_limited', retryAfterMs };
    }
    if (this.spentTodayMist >= this.limits.dailyBudgetMist) {
      return { allowed: false, reason: 'daily_budget_exhausted' };
    }
    return { allowed: true };
  }

  /** Records a successful (or attempted) call. */
  record(gasMist: bigint): void {
    this.rollDailyWindow();
    this.trimRateWindow();
    this.requestTimestamps.push(this.nowMs());
    if (gasMist > 0n) this.spentTodayMist += gasMist;
  }

  snapshot(): { rateUsed: number; spentTodayMist: bigint; currentUtcDay: number } {
    this.rollDailyWindow();
    this.trimRateWindow();
    return {
      rateUsed: this.requestTimestamps.length,
      spentTodayMist: this.spentTodayMist,
      currentUtcDay: this.currentUtcDay,
    };
  }

  private trimRateWindow(): void {
    const cutoff = this.nowMs() - 60_000;
    while (this.requestTimestamps.length > 0) {
      const t = this.requestTimestamps[0];
      if (t === undefined || t >= cutoff) break;
      this.requestTimestamps.shift();
    }
  }

  private rollDailyWindow(): void {
    const today = Math.floor(this.nowMs() / 86_400_000);
    if (today !== this.currentUtcDay) {
      this.currentUtcDay = today;
      this.spentTodayMist = 0n;
    }
  }
}

export function rateLimitedChainError(check: GasStationCheck): ChainError {
  if (check.reason === 'rate_limited') {
    return new ChainError('execution_failed', `rate limited; retry after ${check.retryAfterMs ?? 0}ms`);
  }
  return new ChainError('execution_failed', 'gas station daily budget exhausted');
}
