/**
 * x402 spec types (Sprint 2, S2-T02).
 *
 * The on-the-wire shape matches x402.org/spec; we extend it with optional
 * Sui-specific fields (sessionObjectId, intentId) the facilitator uses to
 * route into the right Move entrypoint without requiring callers to manage
 * raw object IDs themselves.
 *
 * Atomic amounts are serialized as decimal strings on the wire (BigInt is
 * not JSON-safe) and converted at the boundary via `bigintFromAtomicString`.
 */

export const X402_VERSION = '0.1.0' as const;

export type Scheme = 'exact' | 'upto';

export type Network =
  | 'sui-mainnet'
  | 'sui-testnet'
  | 'sui-devnet'
  | 'base-mainnet'
  | 'solana-mainnet';

export const ALL_SCHEMES: readonly Scheme[] = ['exact', 'upto'] as const;
export const ALL_NETWORKS: readonly Network[] = [
  'sui-mainnet',
  'sui-testnet',
  'sui-devnet',
  'base-mainnet',
  'solana-mainnet',
] as const;

// ─── Payment details — what the seller is charging for ─────────────────────

export interface PaymentDetails {
  scheme: Scheme;
  network: Network;
  /** Sui object id of the server being called (registry::Server). */
  serverObjectId: string;
  /** Tool name on that server (e.g. "query"). */
  toolName: string;
  /** Price in coin smallest units (USDsui = 6 decimals). String on wire. */
  amountAtomic: bigint;
  /** Type tag of the token, e.g. "0x..::usdsui::USDSUI". */
  tokenType: string;
  /** Unix ms after which this quote is no longer valid. */
  validUntilMs: number;
  /** Optional caller-supplied metadata (request id, agent name, etc.). */
  metadata?: Record<string, unknown>;
}

// ─── Payment payload — what the buyer signs ────────────────────────────────

export interface PaymentPayload {
  /** Caller signature over canonical JSON of PaymentDetails. */
  signature: string;
  /** Sui address of the payer. */
  payerAddress: string;
  /** Sui session object id the payer is debiting. */
  sessionObjectId: string;
  /** Optional spending intent id (Sprint 6 feature, accepted for forward compat). */
  intentId?: string;
  /** Echo of the PaymentDetails this signature was issued against. */
  details: PaymentDetails;
}

// ─── /verify response ─────────────────────────────────────────────────────

export interface VerifyResult {
  isValid: boolean;
  /** Stable machine-readable reason code. Present iff !isValid. */
  invalidReason?: VerifyInvalidReason;
  /** Human-readable supplement to `invalidReason`. */
  message?: string;
}

export type VerifyInvalidReason =
  | 'invalid_signature'
  | 'expired_quote'
  | 'unsupported_scheme'
  | 'unsupported_network'
  | 'session_not_found'
  | 'session_inactive'
  | 'insufficient_balance'
  | 'per_call_cap_exceeded'
  | 'per_day_cap_exceeded'
  | 'server_not_authorized'
  | 'intent_not_found'
  | 'intent_revoked'
  | 'intent_cap_exceeded'
  | 'platform_paused'
  | 'malformed_payload';

// ─── /settle response ─────────────────────────────────────────────────────

export interface SettleResult {
  success: boolean;
  /** Sui tx digest of the settle_call PTB on success. */
  txDigest?: string;
  /** CallReceipt object id minted in the same PTB. */
  receiptObjectId?: string;
  /** How much was actually charged (for upto-mode this can be ≤ amountAtomic). */
  settledAmountAtomic?: bigint;
  /** Walrus blob id where the request/response payload was archived (set when caller provides). */
  receiptBlobId?: string;
  /** Stable reason code if settlement failed. */
  errorCode?: SettleErrorCode;
  /** Human-readable supplement to `errorCode`. */
  errorMessage?: string;
}

export type SettleErrorCode =
  | 'verify_failed' // /verify would have returned !isValid
  | 'chain_error' // PTB execution failed on chain
  | 'gas_budget_exceeded'
  | 'rate_limited'
  | 'platform_paused'
  | 'internal_error';

// ─── /supported response ──────────────────────────────────────────────────

export interface SupportedResult {
  schemes: Scheme[];
  networks: Network[];
  /** Sui type tag of the settlement token (USDsui type). */
  tokenType: string;
  /** Version string of this facilitator implementation. */
  facilitatorVersion: string;
  /** x402 spec version this implementation conforms to. */
  x402Version: typeof X402_VERSION;
}

// ─── Wire (JSON-serialisable) shapes ─────────────────────────────────────

/**
 * On-the-wire form — bigint replaced with decimal string. Parsers convert.
 */
export interface PaymentDetailsWire
  extends Omit<PaymentDetails, 'amountAtomic'> {
  amountAtomic: string;
}

export interface PaymentPayloadWire
  extends Omit<PaymentPayload, 'details'> {
  details: PaymentDetailsWire;
}

export interface SettleResultWire
  extends Omit<SettleResult, 'settledAmountAtomic'> {
  settledAmountAtomic?: string;
}
