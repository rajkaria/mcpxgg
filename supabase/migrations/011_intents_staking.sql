-- ============================================================
-- S6-T21 / S6-T26: intents per-call cap + S7 staking mirror + abuse flags
-- ============================================================
--
-- 1. intents          — add per_call_cap_atomic (S6-T01 added it to the Move
--                        SpendingIntent + IntentCreated event; S6-T04 mirrors
--                        it) and allowed_categories (the intent's category
--                        allowlist; the IntentCreated event does not yet carry
--                        it, so it defaults to '{}' until a richer event does).
-- 2. server_stakes     — mirror for mcpx::staking (S7). Created here so the
--                        indexer schema stays monolithic; data arrives once
--                        StakePosted / StakeWithdrawn ship in Sprint 7.
-- 3. abuse_flags       — S6-T26 anomaly flags written by the indexer abuse
--                        heuristic (>3 sigma vs population). The admin review
--                        queue UI (separate task) reads these.
-- 4. account_aggregates(p_window_start, p_window_end) — SQL function the
--                        abuse heuristic calls to get per-account call volume
--                        + spend over a closed window from the chain-mirror
--                        request_log (GROUP BY isn't expressible via
--                        supabase-js).
--
-- MIRROR-ONLY (ADR-011): intents, server_stakes, abuse_flags are written
-- *exclusively* by apps/indexer (abuse_flags by its abuse heuristic on the
-- indexer cadence). Route handlers / the web app MUST treat them read-only;
-- the chain owns intents/stakes and the indexer owns abuse_flags.
-- ============================================================

-- 1. intents: per-call cap + category allowlist (nullable / defaulted so the
--    existing frozen handler shape still upserts; S6-T04 fills per_call_cap).
ALTER TABLE public.intents
  ADD COLUMN IF NOT EXISTS per_call_cap_atomic BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allowed_categories  TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.intents.per_call_cap_atomic IS
  'Per-call spend ceiling in USDsui atomic units (6dp). 0 = uncapped. Mirror of SpendingIntent.per_call_cap (S6-T01/T04).';
COMMENT ON COLUMN public.intents.allowed_categories IS
  'Category allowlist the agent may spend against. Empty = all. Defaults ''{}'' until a richer IntentCreated event carries it.';

-- 2. server_stakes mirror (S7 staking). One row per stake object.
CREATE TABLE IF NOT EXISTS public.server_stakes (
  stake_object_id   TEXT PRIMARY KEY,
  chain_id          TEXT NOT NULL DEFAULT 'sui',
  server_object_id  TEXT NOT NULL,
  staker            TEXT NOT NULL,
  amount_atomic     BIGINT NOT NULL,
  staked_at_ms      BIGINT NOT NULL,
  withdrawn         BOOLEAN NOT NULL DEFAULT FALSE,
  tx_digest         TEXT NOT NULL,
  indexed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_server_stakes_server
  ON public.server_stakes(server_object_id);
CREATE INDEX IF NOT EXISTS idx_server_stakes_staker
  ON public.server_stakes(staker);

COMMENT ON TABLE public.server_stakes IS
  'Indexer mirror of mcpx::staking server stakes (S7). Indexer-written only (ADR-011). Distinct from the legacy `stakes` stub in 007.';

-- 3. abuse_flags (S6-T26). Indexer-written; admin review UI reads + updates
--    `status`. created_at is the flag time; window_* bound the analysis window.
CREATE TABLE IF NOT EXISTS public.abuse_flags (
  id               BIGSERIAL PRIMARY KEY,
  account_address  TEXT NOT NULL,
  metric           TEXT NOT NULL CHECK (metric IN ('call_volume', 'spend_atomic')),
  zscore           DOUBLE PRECISION NOT NULL,
  window_start_ms  BIGINT NOT NULL,
  window_end_ms    BIGINT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_abuse_flags_status
  ON public.abuse_flags(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abuse_flags_account
  ON public.abuse_flags(account_address);
-- Replay-safe: one flag per (account, metric, window) so a re-run of the
-- heuristic over the same closed window is a no-op rather than a dup.
CREATE UNIQUE INDEX IF NOT EXISTS uq_abuse_flags_account_metric_window
  ON public.abuse_flags(account_address, metric, window_start_ms, window_end_ms);

COMMENT ON TABLE public.abuse_flags IS
  'Indexer abuse heuristic output (S6-T26): accounts >3 sigma vs population call-volume/spend over a closed window. Indexer-written; admin UI updates status.';

-- 4. account_aggregates: per-account call volume + spend over [start,end).
--    SECURITY DEFINER so the indexer service role gets the same rows the
--    heuristic expects regardless of RLS on request_log.
CREATE OR REPLACE FUNCTION public.account_aggregates(
  p_window_start TIMESTAMPTZ,
  p_window_end   TIMESTAMPTZ
)
RETURNS TABLE (
  account_address TEXT,
  call_volume     BIGINT,
  spend_atomic    NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rl.owner_address                          AS account_address,
    COUNT(*)                                  AS call_volume,
    COALESCE(SUM(rl.amount_atomic), 0)::NUMERIC AS spend_atomic
  FROM public.request_log rl
  WHERE rl.owner_address IS NOT NULL
    AND rl.created_at >= p_window_start
    AND rl.created_at <  p_window_end
  GROUP BY rl.owner_address;
$$;

COMMENT ON FUNCTION public.account_aggregates(TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Per-account call volume + USDsui spend over [start,end) from the chain-mirror request_log. Used by the S6-T26 abuse heuristic.';

-- RLS: public read (admin UI), service_role full (indexer).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN VALUES ('server_stakes'), ('abuse_flags')
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
