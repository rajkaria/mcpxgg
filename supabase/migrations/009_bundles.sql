-- ============================================================
-- S5-T17/T19: composable-bundles indexer mirror
-- ============================================================
--
-- Migration 007 stood up bare `bundles` / `bundle_activations` tables for
-- the Sprint-5 bundle feature. This migration finalises that schema:
--   1. bundles            — add name, metadata_blob_id, active so the
--                            /bundles page can render without a chain RPC
--   2. bundle_activations — add an idempotent uniqueness key so the indexer
--                            can replay BundleActivated without dup rows
--
-- MIRROR-ONLY (ADR-011): these tables are written *exclusively* by the
-- indexer from on-chain BundleCreated / BundleActivated events. The web app
-- and route handlers MUST treat them read-only — the chain owns this state.
-- ============================================================

-- 1. bundles: richer columns (all nullable / defaulted so the frozen
--    indexer handler that only emits creator/server_count still upserts).
ALTER TABLE public.bundles
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS metadata_blob_id TEXT,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.bundles.name IS
  'Bundle display name (utf8 from bundle::create). Null until a richer event carries it; the /bundles page coalesces to the curated catalog name.';
COMMENT ON COLUMN public.bundles.metadata_blob_id IS
  'Walrus blob id for the bundle metadata doc, or null.';
COMMENT ON COLUMN public.bundles.active IS
  'False once the curator calls bundle::deactivate (BundleDeactivated mirror).';
COMMENT ON TABLE public.bundles IS
  'Indexer mirror of mcpx::bundle::Bundle. Indexer-written only (ADR-011).';

-- 2. bundle_activations idempotency. 007 made `id` BIGSERIAL the PK with no
--    natural key, so an indexer replay would duplicate rows. Add a unique
--    index on (bundle, user, tx_digest) — the indexer's natural dedup key.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bundle_activations_event
  ON public.bundle_activations(bundle_object_id, user_address, tx_digest);

COMMENT ON TABLE public.bundle_activations IS
  'Indexer mirror of BundleActivated events. One row per (bundle,user,tx); replay-safe via uq_bundle_activations_event. Indexer-written only (ADR-011).';

-- 3. Public read view: shape the /bundles page consumes. price_multiplier_x100
--    is the per-call multiplier ×100 (100 = 1.0x = full price, 90 = 0.9x =
--    10% off). discount_pct = max(0, 100 - mult) so a >100 multiplier (a
--    premium bundle) clamps to 0% rather than going negative.
CREATE OR REPLACE VIEW public.bundles_public AS
SELECT
  b.bundle_object_id,
  b.name,
  b.creator_address,
  b.server_count,
  b.price_multiplier_x100,
  b.metadata_blob_id,
  b.active,
  b.tx_digest,
  b.created_at,
  GREATEST(0, 100 - b.price_multiplier_x100)::INTEGER AS discount_pct
FROM public.bundles b;

COMMENT ON VIEW public.bundles_public IS
  'Read shape for apps/web /bundles. discount_pct = whole-percent off (90 mult → 10%).';
