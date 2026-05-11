-- ============================================================
-- S2-T19: Indexer-side schema for Sprint 2
-- ============================================================
--
-- This migration finalises the indexer-mirror schema:
--   1. `indexer_event_log`     — (tx_digest, event_seq) dedup primary key
--   2. `indexer_checkpoints`   — add `last_tx_digest` for replay
--   3. Sprint-2 mirror tables  — mcp_servers.namespace, mcp_tools.server_object_id,
--                                request_log.server_object_id / .owner_address / .tool_name
--   4. Sprint-6+ mirror tables — quality_attestations, intents, intent_usages,
--                                stakes, stake_slashes, bundles, bundle_activations,
--                                reviews_onchain
--   5. Materialized views     — marketplace_servers, dashboard_usage, live_feed_24h
--   6. Helper RPC functions   — apply_session_deposit, apply_vault_claim,
--                                apply_platform_delta, refresh_indexer_views
--
-- All tables enable RLS; service_role bypass + targeted SELECT policies.
-- ============================================================

-- ─── 1. Dedup log ─────────────────────────────────────────────────────────
CREATE TABLE public.indexer_event_log (
  chain_id TEXT NOT NULL DEFAULT 'sui',
  tx_digest TEXT NOT NULL,
  event_seq BIGINT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tx_digest, event_seq)
);

CREATE INDEX idx_indexer_event_log_observed ON public.indexer_event_log(observed_at DESC);

ALTER TABLE public.indexer_event_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages indexer event log"
  ON public.indexer_event_log FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── 2. Checkpoint resume cursor ─────────────────────────────────────────
ALTER TABLE public.indexer_checkpoints
  ADD COLUMN IF NOT EXISTS last_tx_digest TEXT;

COMMENT ON COLUMN public.indexer_checkpoints.last_tx_digest IS
  'Sui tx digest of the last processed event. Required to resume queryEvents pagination.';

-- ─── 3. Sprint-2 mirror columns ──────────────────────────────────────────

-- mcp_servers: namespace + display fields not present in 005 (we'll let the
-- indexer write them; the original column is the human-editable namespace and
-- gets overwritten at publish time).
-- (No-op if namespace already exists from migration 005.)

-- mcp_tools: bind to server_object_id so the indexer can upsert by
-- (server_object_id, tool_name) before the parent's UUID exists.
ALTER TABLE public.mcp_tools
  ADD COLUMN IF NOT EXISTS server_object_id TEXT;

CREATE INDEX IF NOT EXISTS idx_mcp_tools_server_object
  ON public.mcp_tools(server_object_id)
  WHERE server_object_id IS NOT NULL;

-- request_log: replicate server / payer / tool name fields from the on-chain
-- event so reads don't need a JOIN. server_id is still the FK to mcp_servers
-- when the indexer can resolve it; server_object_id is the authoritative key.
ALTER TABLE public.request_log
  ADD COLUMN IF NOT EXISTS server_object_id TEXT,
  ADD COLUMN IF NOT EXISTS owner_address TEXT;

CREATE INDEX IF NOT EXISTS idx_request_log_server_object
  ON public.request_log(server_object_id)
  WHERE server_object_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_request_log_owner_address
  ON public.request_log(owner_address)
  WHERE owner_address IS NOT NULL;

-- ─── 4. Sprint-6+ mirror tables (created here so the indexer types stay
-- ─── monolithic; data starts arriving once the Move features ship). ──────

CREATE TABLE IF NOT EXISTS public.quality_attestations (
  attestation_object_id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL DEFAULT 'sui',
  server_object_id TEXT NOT NULL,
  score_x100 INTEGER NOT NULL,
  uptime_x100 INTEGER NOT NULL,
  p95_latency_ms INTEGER NOT NULL,
  error_rate_x100 INTEGER NOT NULL,
  sample_count BIGINT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  tx_digest TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_quality_attestations_server ON public.quality_attestations(server_object_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS public.intents (
  intent_object_id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL DEFAULT 'sui',
  user_address TEXT NOT NULL,
  agent_address TEXT NOT NULL,
  daily_cap_atomic BIGINT NOT NULL,
  expires_at_ms BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  tx_digest TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_intents_user ON public.intents(user_address);
CREATE INDEX idx_intents_agent ON public.intents(agent_address);

CREATE TABLE IF NOT EXISTS public.intent_usages (
  id BIGSERIAL PRIMARY KEY,
  intent_object_id TEXT NOT NULL,
  receipt_object_id TEXT NOT NULL,
  amount_atomic BIGINT NOT NULL,
  tx_digest TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_intent_usages_intent ON public.intent_usages(intent_object_id);

CREATE TABLE IF NOT EXISTS public.stakes (
  stake_object_id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL DEFAULT 'sui',
  server_object_id TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  amount_atomic BIGINT NOT NULL,
  sla_uptime_x100 INTEGER NOT NULL,
  tx_digest TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_stakes_server ON public.stakes(server_object_id);

CREATE TABLE IF NOT EXISTS public.stake_slashes (
  id BIGSERIAL PRIMARY KEY,
  stake_object_id TEXT NOT NULL,
  server_object_id TEXT NOT NULL,
  amount_atomic BIGINT NOT NULL,
  reason TEXT NOT NULL,
  slashed_at TIMESTAMPTZ NOT NULL,
  tx_digest TEXT NOT NULL
);
CREATE INDEX idx_stake_slashes_stake ON public.stake_slashes(stake_object_id, slashed_at DESC);

CREATE TABLE IF NOT EXISTS public.bundles (
  bundle_object_id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL DEFAULT 'sui',
  creator_address TEXT NOT NULL,
  server_count INTEGER NOT NULL,
  price_multiplier_x100 INTEGER NOT NULL,
  tx_digest TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bundle_activations (
  id BIGSERIAL PRIMARY KEY,
  bundle_object_id TEXT NOT NULL,
  user_address TEXT NOT NULL,
  activated_at TIMESTAMPTZ NOT NULL,
  tx_digest TEXT NOT NULL
);
CREATE INDEX idx_bundle_activations_bundle ON public.bundle_activations(bundle_object_id);

CREATE TABLE IF NOT EXISTS public.reviews_onchain (
  review_object_id TEXT PRIMARY KEY,
  chain_id TEXT NOT NULL DEFAULT 'sui',
  server_object_id TEXT NOT NULL,
  reviewer_address TEXT NOT NULL,
  rating_x10 SMALLINT NOT NULL CHECK (rating_x10 BETWEEN 10 AND 50),
  tx_digest TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_reviews_onchain_server ON public.reviews_onchain(server_object_id, created_at DESC);

-- RLS for new tables: indexer (service role) writes, everyone can read.
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN VALUES
    ('quality_attestations'),
    ('intents'),
    ('intent_usages'),
    ('stakes'),
    ('stake_slashes'),
    ('bundles'),
    ('bundle_activations'),
    ('reviews_onchain')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "Public can read %I" ON public.%I FOR SELECT USING (true)',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "Service role manages %I" ON public.%I FOR ALL USING (auth.role() = ''service_role'') WITH CHECK (auth.role() = ''service_role'')',
      t, t
    );
  END LOOP;
END $$;

-- ─── 5. Materialized views ───────────────────────────────────────────────

-- marketplace_servers: read-fast view powering the marketplace page.
CREATE MATERIALIZED VIEW IF NOT EXISTS public.marketplace_servers AS
SELECT
  s.id,
  s.object_id,
  s.namespace,
  s.name,
  s.description,
  s.category,
  s.tags,
  s.icon_url,
  s.is_featured,
  s.status,
  s.metadata_blob_id,
  s.published_at,
  s.owner_address,
  s.tx_digest,
  COUNT(DISTINCT t.tool_name) AS tool_count,
  COALESCE(MIN(t.price_atomic), 0)::TEXT AS min_price_atomic,
  COALESCE(MAX(t.price_atomic), 0)::TEXT AS max_price_atomic,
  (
    SELECT q.score_x100 FROM public.quality_attestations q
    WHERE q.server_object_id = s.object_id
    ORDER BY q.observed_at DESC LIMIT 1
  ) AS latest_quality_x100,
  (
    SELECT COUNT(*) FROM public.reviews_onchain r WHERE r.server_object_id = s.object_id
  ) AS review_count,
  (
    SELECT AVG(r.rating_x10)::NUMERIC(4,1)
    FROM public.reviews_onchain r WHERE r.server_object_id = s.object_id
  ) AS avg_rating_x10
FROM public.mcp_servers s
LEFT JOIN public.mcp_tools t ON t.server_object_id = s.object_id
WHERE s.object_id IS NOT NULL
  AND s.status = 'active'
GROUP BY s.id;

CREATE UNIQUE INDEX idx_marketplace_servers_object_id ON public.marketplace_servers(object_id);
CREATE INDEX idx_marketplace_servers_category ON public.marketplace_servers(category);

-- dashboard_usage: per-user request-log roll-up with explorer-friendly links.
CREATE MATERIALIZED VIEW IF NOT EXISTS public.dashboard_usage AS
SELECT
  rl.id,
  rl.owner_address,
  rl.server_object_id,
  rl.tool_name,
  rl.amount_atomic::TEXT AS amount_atomic,
  rl.dev_share_atomic::TEXT AS dev_share_atomic,
  rl.treasury_share_atomic::TEXT AS treasury_share_atomic,
  rl.insurance_share_atomic::TEXT AS insurance_share_atomic,
  rl.receipt_blob_id,
  rl.receipt_object_id,
  rl.tx_digest,
  rl.status,
  rl.created_at,
  ms.namespace,
  ms.name AS server_name,
  ms.icon_url AS server_icon_url
FROM public.request_log rl
LEFT JOIN public.marketplace_servers ms ON ms.object_id = rl.server_object_id;

CREATE INDEX idx_dashboard_usage_owner ON public.dashboard_usage(owner_address, created_at DESC);
CREATE INDEX idx_dashboard_usage_server ON public.dashboard_usage(server_object_id, created_at DESC);

-- live_feed_24h: the last 24h of CallSettled events for the /live page.
CREATE MATERIALIZED VIEW IF NOT EXISTS public.live_feed_24h AS
SELECT
  rl.tx_digest,
  rl.receipt_object_id,
  rl.server_object_id,
  rl.owner_address AS payer_address,
  rl.tool_name,
  rl.amount_atomic::TEXT AS amount_atomic,
  rl.created_at,
  ms.namespace,
  ms.name AS server_name
FROM public.request_log rl
LEFT JOIN public.marketplace_servers ms ON ms.object_id = rl.server_object_id
WHERE rl.created_at >= NOW() - INTERVAL '24 hours'
  AND rl.status IN ('success', 'refunded');

CREATE INDEX idx_live_feed_24h_created ON public.live_feed_24h(created_at DESC);

-- Refresh helpers — call via cron or supabase scheduled functions.
CREATE OR REPLACE FUNCTION public.refresh_indexer_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.marketplace_servers;
  REFRESH MATERIALIZED VIEW public.dashboard_usage;
  REFRESH MATERIALIZED VIEW public.live_feed_24h;
END $$;

COMMENT ON FUNCTION public.refresh_indexer_views() IS
  'Refresh all indexer-mirror materialized views. Call from cron every 30s for /live freshness.';

-- ─── 6. Helper RPCs for the indexer (TS Supabase storage adapter) ────────

CREATE OR REPLACE FUNCTION public.apply_session_deposit(
  p_session TEXT,
  p_new_balance BIGINT,
  p_amount BIGINT,
  p_tx TEXT
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.chain_balances
  SET balance_atomic = p_new_balance,
      lifetime_deposited_atomic = lifetime_deposited_atomic + p_amount,
      last_tx_digest = p_tx,
      last_synced_at = NOW()
  WHERE session_object_id = p_session;
END $$;

CREATE OR REPLACE FUNCTION public.apply_vault_claim(
  p_vault TEXT,
  p_amount BIGINT,
  p_tx TEXT
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.developer_vaults
  SET accrued_balance_atomic = GREATEST(accrued_balance_atomic - p_amount, 0),
      lifetime_claimed_atomic = lifetime_claimed_atomic + p_amount,
      last_tx_digest = p_tx,
      last_synced_at = NOW()
  WHERE vault_object_id = p_vault;
END $$;

CREATE OR REPLACE FUNCTION public.apply_platform_delta(
  p_field TEXT,
  p_amount BIGINT,
  p_tx TEXT
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_field NOT IN (
    'treasury_balance_atomic',
    'insurance_balance_atomic',
    'treasury_lifetime_atomic',
    'insurance_lifetime_atomic',
    'insurance_paid_atomic'
  ) THEN
    RAISE EXCEPTION 'apply_platform_delta: unknown field %', p_field;
  END IF;

  EXECUTE format(
    'UPDATE public.platform_state SET %I = %I + $1, last_tx_digest = $2, last_synced_at = NOW() WHERE chain_id = ''sui''',
    p_field, p_field
  ) USING p_amount, p_tx;
END $$;

-- ─── 7. Drop the deprecated `credit_cost` column on tools ────────────────
ALTER TABLE public.mcp_tools DROP COLUMN IF EXISTS credit_cost;

COMMENT ON TABLE public.indexer_event_log IS
  'Dedup primary key for the Sui indexer. Inserting a duplicate (tx_digest, event_seq) fails with unique_violation; the indexer treats that as a no-op.';
