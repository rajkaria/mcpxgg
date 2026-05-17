-- ============================================================
-- S6-T25: Featured server rotation (APP-OWNED, NOT a mirror)
-- ============================================================
--
-- IMPORTANT — distinction from indexer-mirror tables (ADR-011):
--   Every other public table that holds on-chain facts (mcp_servers,
--   intents, quality_attestations, request_log, bundles, …) is written
--   ONLY by the indexer from Sui events; the web app reads them and must
--   never write them.
--
--   `featured_servers` is the opposite: it is purely an editorial /
--   curation artifact owned by the MCPX app. No Sui event backs it. The
--   admin UI (/dashboard/admin/featured) writes it via the service role;
--   the marketplace home reads it. It is safe for the app to mutate.
--
-- It only references on-chain servers by their `object_id` — it never
-- duplicates on-chain state.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.featured_servers (
  id          BIGSERIAL PRIMARY KEY,
  server_object_id TEXT NOT NULL,
  week_start  DATE NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (week_start, server_object_id)
);

CREATE INDEX IF NOT EXISTS idx_featured_servers_week
  ON public.featured_servers(week_start DESC, position ASC);

ALTER TABLE public.featured_servers ENABLE ROW LEVEL SECURITY;

-- Anyone can read the current featured set (marketplace home is public).
CREATE POLICY "Public can read featured_servers"
  ON public.featured_servers FOR SELECT USING (true);

-- Only the service role (admin API route) may mutate it.
CREATE POLICY "Service role manages featured_servers"
  ON public.featured_servers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.featured_servers IS
  'APP-OWNED editorial curation (NOT an indexer mirror). Written by the admin UI via service role; read by the marketplace home. References on-chain servers by object_id only.';
