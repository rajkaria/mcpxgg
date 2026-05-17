-- ============================================================
-- S7: x402 `upto` finalization mirror columns
-- ============================================================
--
-- settlement::settle_call_upto[_with_intent] quotes a max spend up front and
-- finalizes the actual amount once the tool call returns, emitting
-- `UptoFinalized { receipt_id, quoted_max_atomic, actual_atomic,
-- unused_atomic, timestamp_ms }`. The indexer mirrors that onto the existing
-- `request_log` receipt row so the web `/insurance` dashboard + per-call
-- "quoted vs actual" view can read it (ADR-011: mirror only, indexer is the
-- sole writer).
--
-- Nullable: only `upto`-scheme calls finalize; classic `exact` settlement
-- leaves these NULL.
-- ============================================================

ALTER TABLE public.request_log
  ADD COLUMN quoted_max_atomic BIGINT,
  ADD COLUMN actual_atomic     BIGINT,
  ADD COLUMN unused_atomic     BIGINT;

COMMENT ON COLUMN public.request_log.quoted_max_atomic IS
  'S7 upto-scheme: max amount quoted before the call (UptoFinalized.quoted_max_atomic). NULL for exact settlement.';
COMMENT ON COLUMN public.request_log.actual_atomic IS
  'S7 upto-scheme: actual amount settled after the call (UptoFinalized.actual_atomic). NULL for exact settlement.';
COMMENT ON COLUMN public.request_log.unused_atomic IS
  'S7 upto-scheme: quoted_max - actual returned to the payer (UptoFinalized.unused_atomic). NULL for exact settlement.';
