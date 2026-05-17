-- ============================================================
-- S6-T20: QualityAttestation indexer mirror (finalize)
-- ============================================================
--
-- Migration 007 stubbed a bare `quality_attestations` table so the indexer
-- types could stay monolithic before the quality feature shipped. Sprint 6
-- ships the quality oracle (S6-T18) + `mcpx::quality::attest`, whose
-- QualityAttestation object additionally carries the closed measurement
-- window and the attesting oracle address. This migration finalizes the
-- mirror to those fields.
--
-- The on-chain QualityAttested *event* (events.move) only carries
-- timestamp_ms (= attested_at_ms), so window_start_ms / window_end_ms /
-- attested_by are nullable: the indexer fills attested_at_ms from the event
-- and the window columns stay null until a richer event carries them. The
-- oracle service knows the window it computed over and can backfill via the
-- attestation object if needed.
--
-- MIRROR-ONLY (ADR-011): `quality_attestations` is written *exclusively* by
-- apps/indexer from on-chain QualityAttested events (and never by the oracle
-- directly — the oracle submits the Move tx; the indexer mirrors it). The
-- web app and route handlers MUST treat it read-only — the chain owns this
-- state.
-- ============================================================

ALTER TABLE public.quality_attestations
  ADD COLUMN IF NOT EXISTS window_start_ms BIGINT,
  ADD COLUMN IF NOT EXISTS window_end_ms   BIGINT,
  ADD COLUMN IF NOT EXISTS attested_by     TEXT,
  ADD COLUMN IF NOT EXISTS attested_at_ms  BIGINT,
  ADD COLUMN IF NOT EXISTS indexed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();

COMMENT ON COLUMN public.quality_attestations.window_start_ms IS
  'Inclusive start (ms epoch) of the closed 6h measurement window. Null until a richer event carries it; the oracle anchors windows to floor(now/6h)*6h UTC.';
COMMENT ON COLUMN public.quality_attestations.window_end_ms IS
  'Exclusive end (ms epoch) of the closed 6h measurement window.';
COMMENT ON COLUMN public.quality_attestations.attested_by IS
  'Sui address of the oracle that signed mcpx::quality::attest, or null.';
COMMENT ON COLUMN public.quality_attestations.attested_at_ms IS
  'clock::timestamp_ms at attest time (= QualityAttested.timestamp_ms).';
COMMENT ON COLUMN public.quality_attestations.indexed_at IS
  'When the indexer mirrored this row (server clock). Distinct from attested_at_ms.';

COMMENT ON TABLE public.quality_attestations IS
  'Indexer mirror of mcpx::quality::QualityAttestation. Indexer-written only (ADR-011); the oracle (S6-T18) submits the on-chain tx, the indexer mirrors the resulting event.';

-- Server-scoped latest-first lookup for the marketplace quality badge (S6-T19).
CREATE INDEX IF NOT EXISTS idx_quality_attestations_server_attested
  ON public.quality_attestations(server_object_id, attested_at_ms DESC);
