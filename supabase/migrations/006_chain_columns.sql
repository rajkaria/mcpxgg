-- ============================================================
-- S1-T18: Chain mirror columns + new chain-state tables
-- ============================================================
--
-- Per ADR-011 (DECISIONS.md), Postgres is a read-fast indexer mirror, not
-- the source of truth. The Sui Move package owns server, tool, session,
-- and settlement state; this migration prepares the schema for the
-- indexer (Sprint 2) to hydrate.
--
-- Conventions:
--   chain_id          - which chain the row mirrors ('sui' for now)
--   object_id         - the Sui object ID for this row's on-chain twin
--   tx_digest         - the Sui tx that most recently mutated it
--   *_atomic          - balances in coin smallest units (USDsui = 6 decimals)
--   *_blob_id         - Walrus blob id for permanent payload storage
--
-- All new columns are nullable today. The indexer fills them as it observes
-- chain events; legacy rows (none yet — fresh repo) stay nullable forever.
-- ============================================================

-- ─── mcp_servers: chain mirror columns ─────────────────────────────────────
ALTER TABLE public.mcp_servers
  ADD COLUMN chain_id TEXT NOT NULL DEFAULT 'sui',
  ADD COLUMN object_id TEXT,
  ADD COLUMN owner_address TEXT,
  ADD COLUMN tx_digest TEXT,
  ADD COLUMN metadata_blob_id TEXT,
  ADD COLUMN on_chain_version BIGINT,
  ADD COLUMN published_block BIGINT;

CREATE UNIQUE INDEX idx_mcp_servers_object_id ON public.mcp_servers(object_id)
  WHERE object_id IS NOT NULL;
CREATE INDEX idx_mcp_servers_owner_address ON public.mcp_servers(owner_address)
  WHERE owner_address IS NOT NULL;

-- ─── mcp_tools: replace credit_cost with on-chain pricing ──────────────────
-- credit_cost was a fixed 1|3|10 selector — Sui pricing is per-call atomic.
-- We add the new columns now; the indexer backfills them from on-chain
-- ToolAdded / ToolRemoved events. credit_cost stays for one sprint as an
-- observability fallback, then drops in S2-T19.
ALTER TABLE public.mcp_tools
  ADD COLUMN price_atomic BIGINT,
  ADD COLUMN free_tier_calls_per_user INTEGER DEFAULT 0,
  ADD COLUMN input_schema_blob_id TEXT,
  ADD COLUMN timeout_seconds INTEGER DEFAULT 30;

COMMENT ON COLUMN public.mcp_tools.price_atomic IS
  'Per-call price in coin smallest units (USDsui = 6 decimals). Replaces credit_cost.';
COMMENT ON COLUMN public.mcp_tools.credit_cost IS
  'DEPRECATED: replaced by price_atomic. To be dropped in migration 007 once gateway is rewired.';

-- ─── request_log: receipt mirror ───────────────────────────────────────────
ALTER TABLE public.request_log
  ADD COLUMN chain_id TEXT NOT NULL DEFAULT 'sui',
  ADD COLUMN receipt_object_id TEXT,
  ADD COLUMN tx_digest TEXT,
  ADD COLUMN session_object_id TEXT,
  ADD COLUMN amount_atomic BIGINT,
  ADD COLUMN dev_share_atomic BIGINT,
  ADD COLUMN treasury_share_atomic BIGINT,
  ADD COLUMN insurance_share_atomic BIGINT,
  ADD COLUMN receipt_blob_id TEXT,
  ADD COLUMN intent_object_id TEXT;

CREATE UNIQUE INDEX idx_request_log_receipt ON public.request_log(receipt_object_id)
  WHERE receipt_object_id IS NOT NULL;
CREATE INDEX idx_request_log_tx_digest ON public.request_log(tx_digest)
  WHERE tx_digest IS NOT NULL;
CREATE INDEX idx_request_log_session ON public.request_log(session_object_id)
  WHERE session_object_id IS NOT NULL;

-- ─── chain_balances: mirror of Session<T> objects ──────────────────────────
CREATE TABLE public.chain_balances (
  session_object_id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL DEFAULT 'sui',
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  owner_address TEXT NOT NULL,
  balance_atomic BIGINT NOT NULL DEFAULT 0,
  per_call_cap_atomic BIGINT NOT NULL DEFAULT 0,
  per_day_cap_atomic BIGINT NOT NULL DEFAULT 0,
  today_spent_atomic BIGINT NOT NULL DEFAULT 0,
  today_epoch_day BIGINT,
  scoped_server_object_ids TEXT[] DEFAULT '{}',
  expires_at_ms BIGINT,
  active BOOLEAN NOT NULL DEFAULT true,
  lifetime_deposited_atomic BIGINT NOT NULL DEFAULT 0,
  lifetime_spent_atomic BIGINT NOT NULL DEFAULT 0,
  last_tx_digest TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chain_balances_user ON public.chain_balances(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_chain_balances_owner ON public.chain_balances(owner_address);
CREATE INDEX idx_chain_balances_active ON public.chain_balances(active) WHERE active = true;

-- ─── developer_vaults: mirror of DeveloperVault<T> ─────────────────────────
CREATE TABLE public.developer_vaults (
  vault_object_id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL DEFAULT 'sui',
  developer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  owner_address TEXT NOT NULL,
  accrued_balance_atomic BIGINT NOT NULL DEFAULT 0,
  lifetime_earnings_atomic BIGINT NOT NULL DEFAULT 0,
  lifetime_claimed_atomic BIGINT NOT NULL DEFAULT 0,
  auto_claim_threshold_atomic BIGINT NOT NULL DEFAULT 0,
  last_tx_digest TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_developer_vaults_developer ON public.developer_vaults(developer_id)
  WHERE developer_id IS NOT NULL;
CREATE INDEX idx_developer_vaults_owner ON public.developer_vaults(owner_address);

-- ─── platform_state: singleton mirror of PlatformConfig + pools ────────────
CREATE TABLE public.platform_state (
  chain_id TEXT PRIMARY KEY DEFAULT 'sui',
  package_id TEXT,
  config_object_id TEXT,
  registry_object_id TEXT,
  treasury_object_id TEXT,
  insurance_object_id TEXT,
  admin_cap_id TEXT,
  take_rate_bps SMALLINT NOT NULL DEFAULT 250,
  insurance_bps SMALLINT NOT NULL DEFAULT 50,
  subsidy_atomic BIGINT NOT NULL DEFAULT 1000000,
  sla_min_stake_atomic BIGINT NOT NULL DEFAULT 10000000,
  paused BOOLEAN NOT NULL DEFAULT false,
  treasury_balance_atomic BIGINT NOT NULL DEFAULT 0,
  insurance_balance_atomic BIGINT NOT NULL DEFAULT 0,
  treasury_lifetime_atomic BIGINT NOT NULL DEFAULT 0,
  insurance_lifetime_atomic BIGINT NOT NULL DEFAULT 0,
  insurance_paid_atomic BIGINT NOT NULL DEFAULT 0,
  last_tx_digest TEXT,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.platform_state (chain_id) VALUES ('sui')
  ON CONFLICT (chain_id) DO NOTHING;

-- ─── indexer_checkpoints: replay-safe progress marker ──────────────────────
CREATE TABLE public.indexer_checkpoints (
  chain_id TEXT PRIMARY KEY DEFAULT 'sui',
  last_processed_checkpoint BIGINT NOT NULL DEFAULT 0,
  last_processed_event_seq BIGINT NOT NULL DEFAULT 0,
  last_processed_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.indexer_checkpoints (chain_id) VALUES ('sui')
  ON CONFLICT (chain_id) DO NOTHING;

-- ─── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.chain_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own chain balances"
  ON public.chain_balances FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Service role manages chain balances"
  ON public.chain_balances FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.developer_vaults ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Developers see their own vaults"
  ON public.developer_vaults FOR SELECT
  USING (developer_id = auth.uid());
CREATE POLICY "Service role manages developer vaults"
  ON public.developer_vaults FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.platform_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view platform state"
  ON public.platform_state FOR SELECT
  USING (true);
CREATE POLICY "Service role updates platform state"
  ON public.platform_state FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.indexer_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages checkpoints"
  ON public.indexer_checkpoints FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── updated_at trigger on platform_state ─────────────────────────────────
CREATE TRIGGER platform_state_updated_at
  BEFORE UPDATE ON public.platform_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
