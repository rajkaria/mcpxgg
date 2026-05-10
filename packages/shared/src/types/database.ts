/**
 * Database row types for the indexer-mirror schema.
 *
 * Authority of truth: Sui chain (Move objects + events). Postgres rows are
 * eventually-consistent mirrors hydrated by `apps/indexer`. Per ADR-011,
 * route handlers MUST NOT write to chain-mirrored columns directly — emit
 * a Move tx, indexer writes.
 *
 * Atomic-unit fields are typed `bigint` because USDsui has 6 decimals and
 * a u64 amount_atomic of (~10^19) overflows JS `number` at 2^53.
 */

export type ChainId = 'sui' | 'base' | 'solana';

// ─── Server registry mirror ────────────────────────────────────────────────

export interface McpServerRow {
  id: string;
  developer_id: string;
  namespace: string;
  name: string;
  description: string;
  long_description: string | null;
  icon_url: string | null;
  category: string | null;
  tags: string[];
  trigger_phrases: string[];
  server_type: 'internal' | 'external';
  endpoint_url: string | null;
  internal_route: string | null;
  status: 'draft' | 'pending_review' | 'active' | 'suspended' | 'archived';
  is_featured: boolean;
  total_calls: number;
  total_users: number;
  avg_rating: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  // Chain mirror columns (added in migration 006)
  chain_id: ChainId;
  object_id: string | null;
  owner_address: string | null;
  tx_digest: string | null;
  metadata_blob_id: string | null;
  on_chain_version: number | null;
  published_block: number | null;
}

// ─── Tool mirror ──────────────────────────────────────────────────────────

export interface McpToolRow {
  id: string;
  server_id: string;
  tool_name: string;
  description: string;
  input_schema: Record<string, unknown>;
  /** @deprecated Replaced by `price_atomic` in migration 006; dropping in 007. */
  credit_cost: number;
  requires_phone: boolean;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
  // Migration 006 additions
  price_atomic: bigint | null;
  free_tier_calls_per_user: number;
  input_schema_blob_id: string | null;
  timeout_seconds: number;
}

// ─── Request / receipt mirror ─────────────────────────────────────────────

export interface RequestLogRow {
  id: string;
  user_id: string;
  server_id: string | null;
  tool_id: string | null;
  tool_name: string;
  namespace: string;
  /** @deprecated Use `amount_atomic`. */
  credit_cost: number | null;
  latency_ms: number | null;
  status: 'success' | 'error' | 'timeout' | 'refunded';
  error_message: string | null;
  request_meta: Record<string, unknown>;
  response_meta: Record<string, unknown>;
  created_at: string;
  // Migration 006 additions
  chain_id: ChainId;
  receipt_object_id: string | null;
  tx_digest: string | null;
  session_object_id: string | null;
  amount_atomic: bigint | null;
  dev_share_atomic: bigint | null;
  treasury_share_atomic: bigint | null;
  insurance_share_atomic: bigint | null;
  receipt_blob_id: string | null;
  intent_object_id: string | null;
}

// ─── Chain-only tables (created in migration 006) ─────────────────────────

export interface ChainBalanceRow {
  session_object_id: string;
  chain_id: ChainId;
  user_id: string | null;
  owner_address: string;
  balance_atomic: bigint;
  per_call_cap_atomic: bigint;
  per_day_cap_atomic: bigint;
  today_spent_atomic: bigint;
  today_epoch_day: number | null;
  scoped_server_object_ids: string[];
  expires_at_ms: number | null;
  active: boolean;
  lifetime_deposited_atomic: bigint;
  lifetime_spent_atomic: bigint;
  last_tx_digest: string | null;
  last_synced_at: string;
  created_at: string;
}

export interface DeveloperVaultRow {
  vault_object_id: string;
  chain_id: ChainId;
  developer_id: string | null;
  owner_address: string;
  accrued_balance_atomic: bigint;
  lifetime_earnings_atomic: bigint;
  lifetime_claimed_atomic: bigint;
  auto_claim_threshold_atomic: bigint;
  last_tx_digest: string | null;
  last_synced_at: string;
  created_at: string;
}

export interface PlatformStateRow {
  chain_id: ChainId;
  package_id: string | null;
  config_object_id: string | null;
  registry_object_id: string | null;
  treasury_object_id: string | null;
  insurance_object_id: string | null;
  admin_cap_id: string | null;
  take_rate_bps: number;
  insurance_bps: number;
  subsidy_atomic: bigint;
  sla_min_stake_atomic: bigint;
  paused: boolean;
  treasury_balance_atomic: bigint;
  insurance_balance_atomic: bigint;
  treasury_lifetime_atomic: bigint;
  insurance_lifetime_atomic: bigint;
  insurance_paid_atomic: bigint;
  last_tx_digest: string | null;
  last_synced_at: string;
  updated_at: string;
}

export interface IndexerCheckpointRow {
  chain_id: ChainId;
  last_processed_checkpoint: number;
  last_processed_event_seq: number;
  last_processed_at: string;
}

// ─── Discriminator helpers ────────────────────────────────────────────────

export const ALL_CHAIN_IDS: readonly ChainId[] = ['sui', 'base', 'solana'] as const;

export function isChainId(v: unknown): v is ChainId {
  return typeof v === 'string' && (ALL_CHAIN_IDS as readonly string[]).includes(v);
}
