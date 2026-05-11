/**
 * Shared types for the indexer.
 *
 * IndexedEvent is the indexer-internal representation of a Sui event. Sui's
 * event payload comes as `parsedJson` (untyped) plus envelope metadata
 * (transaction digest, event sequence, checkpoint, timestamp). The indexer
 * shapes that into IndexedEvent so handler code never touches raw RPC.
 */

export type EventType =
  // Registry
  | 'ServerPublished'
  | 'ServerUpdated'
  | 'ServerDeactivated'
  | 'ToolAdded'
  | 'ToolRemoved'
  // Session
  | 'SessionCreated'
  | 'SessionDeposit'
  | 'SessionWithdraw'
  | 'SessionLimitsUpdated'
  | 'SessionClosed'
  // Settlement
  | 'CallSettled'
  | 'RefundIssued'
  // Vault
  | 'VaultCreated'
  | 'VaultAccrued'
  | 'VaultClaimed'
  // Treasury
  | 'TreasuryCollected'
  | 'TreasuryWithdrawn'
  // Insurance
  | 'InsuranceCollected'
  | 'InsurancePaid'
  // Admin / config
  | 'ConfigUpdated'
  | 'ConfigPaused'
  // Quality
  | 'QualityAttested'
  // Stubs (later sprints)
  | 'IntentCreated'
  | 'IntentRevoked'
  | 'IntentUsed'
  | 'StakePosted'
  | 'StakeSlashed'
  | 'BundleCreated'
  | 'BundleActivated'
  | 'ReviewPosted';

export const ALL_EVENT_TYPES: readonly EventType[] = [
  'ServerPublished',
  'ServerUpdated',
  'ServerDeactivated',
  'ToolAdded',
  'ToolRemoved',
  'SessionCreated',
  'SessionDeposit',
  'SessionWithdraw',
  'SessionLimitsUpdated',
  'SessionClosed',
  'CallSettled',
  'RefundIssued',
  'VaultCreated',
  'VaultAccrued',
  'VaultClaimed',
  'TreasuryCollected',
  'TreasuryWithdrawn',
  'InsuranceCollected',
  'InsurancePaid',
  'ConfigUpdated',
  'ConfigPaused',
  'QualityAttested',
  'IntentCreated',
  'IntentRevoked',
  'IntentUsed',
  'StakePosted',
  'StakeSlashed',
  'BundleCreated',
  'BundleActivated',
  'ReviewPosted',
] as const;

export interface IndexedEvent {
  /** Cursor uniqueness — Sui guarantees (txDigest, eventSeq) is unique. */
  txDigest: string;
  eventSeq: number;
  /** Sui checkpoint sequence number. Used for replay-safe progress. */
  checkpoint: number;
  /** Sui ms-since-epoch when this event was emitted. */
  timestampMs: number;
  /** Last segment of `0x..::events::ServerPublished` etc. */
  eventType: EventType;
  /** Parsed JSON of the Move event struct. */
  parsedJson: Record<string, unknown>;
}

export interface Cursor {
  txDigest: string;
  eventSeq: number;
}

export interface CheckpointState {
  lastProcessedCheckpoint: number;
  lastProcessedEventSeq: number;
  /** Last Sui tx digest indexed. Required to resume `queryEvents` paging. */
  lastTxDigest: string | null;
}
