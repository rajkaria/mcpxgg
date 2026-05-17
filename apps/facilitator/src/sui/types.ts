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
  amountAtomic: bigint;
  /** Spending-intent object id. Present → `settle_call_with_intent`. */
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
  settledAmountAtomic: bigint;
}

export class ChainError extends Error {
  override readonly name = 'ChainError';
  constructor(public readonly code: 'rpc_unreachable' | 'execution_failed' | 'gas_budget_exceeded' | 'unknown', message: string) {
    super(message);
  }
}
