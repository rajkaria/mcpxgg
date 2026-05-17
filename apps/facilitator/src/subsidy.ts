/**
 * Bootstrap subsidy (S4-T15/T16). A new user's first Session can receive a
 * one-time USDsui grant. This module is the *gatekeeper*: it enforces a
 * monthly platform budget + one-grant-per-address, and returns the grant
 * amount the admin signer should disburse.
 *
 * The actual admin-signed disbursement tx is wired with the admin multisig
 * (ADR-001); until then callers treat `{ approved, amountAtomic }` as the
 * authorization and the signer is plugged in at that boundary.
 */

export interface SubsidyConfig {
  /** Per-user one-time grant, atomic USDsui. Default 1.00. */
  perUserAtomic: bigint;
  /** Monthly platform cap, atomic USDsui. */
  monthlyBudgetAtomic: bigint;
}

export interface SubsidyDecision {
  approved: boolean;
  amountAtomic: bigint;
  reason?: string;
  remainingBudgetAtomic: bigint;
}

function utcMonth(nowMs: number): string {
  const d = new Date(nowMs);
  return `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1).toString().padStart(2, '0')}`;
}

export class SubsidyLedger {
  private granted = new Set<string>();
  private spentByMonth = new Map<string, bigint>();

  constructor(private cfg: SubsidyConfig) {}

  snapshot(nowMs: number): { month: string; spentAtomic: bigint; budgetAtomic: bigint } {
    const month = utcMonth(nowMs);
    return {
      month,
      spentAtomic: this.spentByMonth.get(month) ?? 0n,
      budgetAtomic: this.cfg.monthlyBudgetAtomic,
    };
  }

  /** Decide + reserve the grant. Idempotent per address. */
  request(address: string, nowMs: number): SubsidyDecision {
    const month = utcMonth(nowMs);
    const spent = this.spentByMonth.get(month) ?? 0n;
    const remaining = this.cfg.monthlyBudgetAtomic - spent;

    if (this.granted.has(address)) {
      return {
        approved: false,
        amountAtomic: 0n,
        reason: 'already_granted',
        remainingBudgetAtomic: remaining,
      };
    }
    if (this.cfg.perUserAtomic > remaining) {
      return {
        approved: false,
        amountAtomic: 0n,
        reason: 'monthly_budget_exhausted',
        remainingBudgetAtomic: remaining,
      };
    }
    this.granted.add(address);
    this.spentByMonth.set(month, spent + this.cfg.perUserAtomic);
    return {
      approved: true,
      amountAtomic: this.cfg.perUserAtomic,
      remainingBudgetAtomic: remaining - this.cfg.perUserAtomic,
    };
  }
}
