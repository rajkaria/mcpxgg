/**
 * Domain views the facilitator needs from chain. Intentionally smaller than
 * the full Move struct — only fields used for verification or settlement.
 */

export interface SessionView {
  sessionObjectId: string;
  ownerAddress: string;
  active: boolean;
  balanceAtomic: bigint;
  perCallCapAtomic: bigint;
  perDayCapAtomic: bigint;
  todaySpentAtomic: bigint;
  todayEpochDay: number;
  scopedServerObjectIds: string[];
  expiresAtMs: number | null;
}

export interface PlatformConfigView {
  takeRateBps: number;
  insuranceBps: number;
  subsidyAtomic: bigint;
  paused: boolean;
}

export interface SettleSubmitParams {
  payerAddress: string;
  sessionObjectId: string;
  serverObjectId: string;
  toolName: string;
  /**
   * `exact` scheme: the amount to debit.
   * `upto` scheme: the quoted ceiling (`quoted_max_atomic`); the actual
   * debit is `uptoActualAtomic`.
   */
  amountAtomic: bigint;
  /**
   * Upto scheme only. Metered amount actually debited (≤ `amountAtomic`).
   * Present → routes to `settle_call_upto[_with_intent]`. Absent → the
   * existing `settle_call[_with_intent]` exact path (unchanged).
   */
  uptoActualAtomic?: bigint;
  /** Spending-intent object id. Present → `*_with_intent` variant. */
  intentId?: string;
  /** Tool category bytes for the intent's category check. '' if none. */
  category?: string;
  /** Receipt-blob id from the gateway's Walrus upload; '' if none. */
  logBlobId: string;
  /** Whether the underlying server call succeeded. */
  success: boolean;
}

export interface SettleSubmitResult {
  txDigest: string;
  receiptObjectId: string;
  /** Amount actually debited (upto: the metered actual, ≤ quoted max). */
  settledAmountAtomic: bigint;
  /** Upto scheme only: the quoted ceiling that was authorised. */
  quotedMaxAtomic?: bigint;
  /** Upto scheme only: quotedMax − settled (never debited). */
  unusedAtomic?: bigint;
}

export class ChainError extends Error {
  override readonly name = 'ChainError';
  constructor(public readonly code: 'rpc_unreachable' | 'execution_failed' | 'gas_budget_exceeded' | 'unknown', message: string) {
    super(message);
  }
}
