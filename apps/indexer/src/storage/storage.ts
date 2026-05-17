/**
 * Storage interface — what the indexer writes to. Real impl wraps
 * Supabase (postgres). Tests use an InMemoryStorage that records each
 * write so handlers can be asserted against without touching a database.
 *
 * Every write is idempotent: callers pass a (tx_digest, event_seq) dedup
 * key. Storage MUST return `{ wasDuplicate: true }` for events it has
 * already processed.
 *
 * Atomic amounts cross the wire as strings — Postgres BIGINT is 2^63 and
 * JS Number is 2^53, so any path that re-serializes via JSON.parse would
 * silently truncate. Handlers always pass `bigint` here; storage adapters
 * convert at the boundary.
 */

import type { ChainId } from '@mcpxgg/shared';
import type { CheckpointState } from '../types.js';

export type { CheckpointState };

export interface DedupResult {
  wasDuplicate: boolean;
}

// ─── Server / tool mirror ────────────────────────────────────────────────

export interface ServerUpsert {
  serverObjectId: string;
  ownerAddress: string;
  namespace: string;
  metadataBlobId: string;
  category: string;
  txDigest: string;
  publishedAtMs: number;
  active: boolean;
}

export interface ServerUpdate {
  serverObjectId: string;
  version: number;
  txDigest: string;
  timestampMs: number;
}

export interface ServerDeactivation {
  serverObjectId: string;
  txDigest: string;
  timestampMs: number;
}

export interface ToolUpsert {
  serverObjectId: string;
  toolName: string;
  priceAtomic: bigint;
}

export interface ToolRemoval {
  serverObjectId: string;
  toolName: string;
}

// ─── Session mirror ──────────────────────────────────────────────────────

export interface SessionCreate {
  sessionObjectId: string;
  ownerAddress: string;
  initialBalanceAtomic: bigint;
  txDigest: string;
  timestampMs: number;
}

export interface SessionDelta {
  sessionObjectId: string;
  newBalanceAtomic: bigint;
  amountAtomic: bigint;
  txDigest: string;
}

export interface SessionLimits {
  sessionObjectId: string;
  perCallCapAtomic: bigint;
  perDayCapAtomic: bigint;
}

// ─── Request log / receipt mirror ────────────────────────────────────────

export interface RequestLogInsert {
  receiptObjectId: string;
  serverObjectId: string;
  payerAddress: string;
  toolName: string;
  amountAtomic: bigint;
  devShareAtomic: bigint;
  treasuryShareAtomic: bigint;
  insuranceShareAtomic: bigint;
  receiptBlobId: string;
  success: boolean;
  timestampMs: number;
  txDigest: string;
}

// ─── Vault mirror ────────────────────────────────────────────────────────

export interface VaultUpsert {
  vaultObjectId: string;
  ownerAddress: string;
  accruedBalanceAtomic: bigint;
  lifetimeEarningsAtomic: bigint;
  txDigest: string;
}

export interface VaultClaim {
  vaultObjectId: string;
  ownerAddress: string;
  amountAtomic: bigint;
  txDigest: string;
  timestampMs: number;
}

// ─── Treasury / insurance / config ──────────────────────────────────────

export interface PlatformDelta {
  field:
    | 'treasury_balance_atomic'
    | 'insurance_balance_atomic'
    | 'treasury_lifetime_atomic'
    | 'insurance_lifetime_atomic'
    | 'insurance_paid_atomic';
  amountAtomic: bigint;
  txDigest: string;
}

export interface PlatformConfigUpdate {
  takeRateBps: number;
  insuranceBps: number;
  subsidyAtomic: bigint;
  txDigest: string;
}

export interface PlatformPause {
  paused: boolean;
  txDigest: string;
  timestampMs: number;
}

// ─── Quality / intents / stakes / bundles / reviews (stubs) ────────────

export interface QualityAttestation {
  attestationObjectId: string;
  serverObjectId: string;
  scoreX100: number;
  uptimeX100: number;
  p95LatencyMs: number;
  errorRateX100: number;
  sampleCount: number;
  timestampMs: number;
  txDigest: string;
}

export interface IntentCreate {
  intentObjectId: string;
  userAddress: string;
  agentAddress: string;
  dailyCapAtomic: bigint;
  /** Per-call spend ceiling in USDsui atomic units (S6-T04). 0 = uncapped. */
  perCallCapAtomic: bigint;
  expiresAtMs: number;
  txDigest: string;
}

export interface IntentRevoke {
  intentObjectId: string;
  timestampMs: number;
  txDigest: string;
}

export interface IntentUsage {
  intentObjectId: string;
  receiptObjectId: string;
  amountAtomic: bigint;
  txDigest: string;
}

export interface StakeRecord {
  stakeObjectId: string;
  serverObjectId: string;
  ownerAddress: string;
  amountAtomic: bigint;
  slaUptimeX100: number;
  txDigest: string;
}

export interface StakeSlash {
  stakeObjectId: string;
  serverObjectId: string;
  amountAtomic: bigint;
  reason: string;
  timestampMs: number;
  txDigest: string;
}

export interface BundleCreation {
  bundleObjectId: string;
  creatorAddress: string;
  serverCount: number;
  priceMultiplierX100: number;
  txDigest: string;
}

export interface BundleActivation {
  bundleObjectId: string;
  userAddress: string;
  timestampMs: number;
  txDigest: string;
}

export interface ReviewRecord {
  reviewObjectId: string;
  serverObjectId: string;
  reviewerAddress: string;
  ratingX10: number;
  txDigest: string;
}

// ─── Abuse flags (S6-T26) ────────────────────────────────────────────────

export interface AccountAggregate {
  accountAddress: string;
  callVolume: number;
  spendAtomic: bigint;
}

export interface AbuseFlagInsert {
  accountAddress: string;
  /** Which population aggregate tripped: 'call_volume' | 'spend_atomic'. */
  metric: 'call_volume' | 'spend_atomic';
  /** Standard deviations above the population mean (>= 3.0 to flag). */
  zscore: number;
  windowStartMs: number;
  windowEndMs: number;
}

// ─── Storage interface ──────────────────────────────────────────────────

export interface Storage {
  chainId: ChainId;

  recordEvent(dedupKey: { txDigest: string; eventSeq: number }): Promise<DedupResult>;

  upsertServer(u: ServerUpsert): Promise<void>;
  bumpServerVersion(u: ServerUpdate): Promise<void>;
  deactivateServer(u: ServerDeactivation): Promise<void>;
  upsertTool(u: ToolUpsert): Promise<void>;
  removeTool(u: ToolRemoval): Promise<void>;

  createSession(u: SessionCreate): Promise<void>;
  applySessionDeposit(u: SessionDelta): Promise<void>;
  applySessionWithdraw(u: SessionDelta): Promise<void>;
  setSessionLimits(u: SessionLimits): Promise<void>;
  closeSession(sessionObjectId: string, txDigest: string): Promise<void>;

  insertRequestLog(u: RequestLogInsert): Promise<void>;
  markRequestRefunded(receiptObjectId: string, refundAmountAtomic: bigint, txDigest: string): Promise<void>;

  upsertVault(u: VaultUpsert): Promise<void>;
  applyVaultClaim(u: VaultClaim): Promise<void>;

  applyPlatformDelta(u: PlatformDelta): Promise<void>;
  applyPlatformConfig(u: PlatformConfigUpdate): Promise<void>;
  applyPlatformPause(u: PlatformPause): Promise<void>;

  upsertQuality(u: QualityAttestation): Promise<void>;

  upsertIntent(u: IntentCreate): Promise<void>;
  revokeIntent(u: IntentRevoke): Promise<void>;
  recordIntentUsage(u: IntentUsage): Promise<void>;

  upsertStake(u: StakeRecord): Promise<void>;
  recordStakeSlash(u: StakeSlash): Promise<void>;

  upsertBundle(u: BundleCreation): Promise<void>;
  recordBundleActivation(u: BundleActivation): Promise<void>;

  insertReview(u: ReviewRecord): Promise<void>;

  // ─── Abuse detection (S6-T26) ─────────────────────────────────────────
  /**
   * Per-account call volume + spend over a closed window, computed from the
   * chain-mirror `request_log`. Used by the abuse heuristic; pure compute
   * lives in `abuse.ts` so this only does the aggregate read.
   */
  getAccountAggregates(windowStartMs: number, windowEndMs: number): Promise<AccountAggregate[]>;
  insertAbuseFlag(u: AbuseFlagInsert): Promise<void>;

  // ─── Checkpoint ───────────────────────────────────────────────────────

  getCheckpoint(): Promise<CheckpointState>;
  updateCheckpoint(state: CheckpointState): Promise<void>;
}
