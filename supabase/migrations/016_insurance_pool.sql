-- ============================================================
-- S7-A4 (S7-T15/T16): Insurance pool transparency + failed-call refunds
-- ============================================================
--
-- The aggregate pool figures (balance / lifetime collected / lifetime paid)
-- already live on `platform_state` (migration 006: insurance_balance_atomic,
-- insurance_lifetime_atomic, insurance_paid_atomic, insurance_object_id) and
-- are indexer-written. This migration adds the *itemised* mirrors the public
-- /insurance transparency dashboard needs, plus the two `request_log` columns
-- the "Claim refund" UX (S7-T15) reads to know a failed call is still claimable.
--
-- ADR-011: every table/column here is an INDEXER MIRROR of an on-chain event
-- (RefundIssued / InsuranceCollected). The web app and route handlers NEVER
-- write them — they only read. The indexer is a separate workstream; see the
-- TODO(indexer) markers in apps/web for the read-side contract.
-- ============================================================

-- ─── 1. request_log: failed-call refund state (S7-T15) ─────────────────────
-- `refunded` flips true when the payer's claim_for_failed_call tx indexes
-- (the Move call sets receipt.refunded = true and emits RefundIssued).
-- A failed call is "claimable" iff status != 'success' AND refunded = false.
ALTER TABLE public.request_log
  ADD COLUMN IF NOT EXISTS refunded BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS refund_amount_atomic BIGINT,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_tx_digest TEXT;

COMMENT ON COLUMN public.request_log.refunded IS
  'S7-T15: TRUE once the payer reclaimed this failed call from the insurance pool (mcpx::settlement::claim_for_failed_call → RefundIssued). Indexer-written (ADR-011).';

-- ─── 2. insurance_payouts mirror — one row per RefundIssued event ──────────
-- Powers "recent payouts" + "total payouts to date" on /insurance.
CREATE TABLE IF NOT EXISTS public.insurance_payouts (
  original_receipt_id    TEXT PRIMARY KEY,        -- RefundIssued.original_receipt_id
  chain_id               TEXT NOT NULL DEFAULT 'sui',
  payee_address          TEXT,                    -- receipt payer who claimed
  refund_amount_atomic   BIGINT NOT NULL,         -- RefundIssued.refund_amount_atomic
  timestamp_ms           BIGINT NOT NULL,         -- RefundIssued.timestamp_ms
  tx_digest              TEXT NOT NULL,
  indexed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_insurance_payouts_ts
  ON public.insurance_payouts(timestamp_ms DESC);

COMMENT ON TABLE public.insurance_payouts IS
  'Indexer mirror of mcpx RefundIssued events (S7-T16). Indexer-written only (ADR-011); the public /insurance dashboard reads it.';

-- ─── 3. insurance_contributions mirror — one row per InsuranceCollected ────
-- Each on-chain InsuranceCollected (per-call take-rate cut OR a sponsor
-- top_up OR an SLA slash routed to the pool) is mirrored here so the
-- dashboard can rank "top contributors". `source` discriminates the origin.
CREATE TABLE IF NOT EXISTS public.insurance_contributions (
  id                  BIGSERIAL PRIMARY KEY,
  chain_id            TEXT NOT NULL DEFAULT 'sui',
  contributor_address TEXT,                       -- sponsor / payer / slashed staker
  amount_atomic       BIGINT NOT NULL,
  source              TEXT NOT NULL DEFAULT 'take_rate'
                        CHECK (source IN ('take_rate', 'sponsor_topup', 'sla_slash')),
  timestamp_ms        BIGINT NOT NULL,
  tx_digest           TEXT NOT NULL,
  indexed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tx_digest, contributor_address, amount_atomic, timestamp_ms)
);
CREATE INDEX IF NOT EXISTS idx_insurance_contrib_addr
  ON public.insurance_contributions(contributor_address);
CREATE INDEX IF NOT EXISTS idx_insurance_contrib_ts
  ON public.insurance_contributions(timestamp_ms DESC);

COMMENT ON TABLE public.insurance_contributions IS
  'Indexer mirror of mcpx InsuranceCollected events (S7-T16). Indexer-written only (ADR-011); /insurance ranks top contributors from it.';

-- ─── 4. top-contributors rollup view (read by the dashboard) ──────────────
CREATE OR REPLACE VIEW public.insurance_top_contributors AS
  SELECT
    contributor_address,
    SUM(amount_atomic)::BIGINT AS total_atomic,
    COUNT(*)                   AS contribution_count,
    MAX(timestamp_ms)          AS last_contributed_ms
  FROM public.insurance_contributions
  WHERE contributor_address IS NOT NULL
  GROUP BY contributor_address
  ORDER BY total_atomic DESC;

COMMENT ON VIEW public.insurance_top_contributors IS
  'S7-T16: leaderboard of insurance pool contributors, summed across mirrored InsuranceCollected events.';

-- ─── RLS: public read (transparency dashboard), service_role writes ────────
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN VALUES ('insurance_payouts'), ('insurance_contributions')
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
