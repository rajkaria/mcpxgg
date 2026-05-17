-- ============================================================
-- S7-T09: SLA auto-slash breach-streak state (oracle-owned)
-- ============================================================
--
-- oracle_breach_streaks — durable per-stake count of consecutive in-breach
-- 6h windows. The quality-oracle is the SOLE writer; it needs this to enforce
-- the "slash only after ≥2 consecutive breached windows" rule across process
-- restarts (the oracle is stateless between runs).
--
-- This is NOT a chain mirror — it is operational state the oracle derives
-- itself (ADR-011 governs mirror tables only). The web app / route handlers
-- never read or write it; the slash *outcome* is observed via the existing
-- `stake_slashes` mirror (migration 007) once the StakeSlashed event indexes.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oracle_breach_streaks (
  stake_object_id       TEXT PRIMARY KEY,
  consecutive_breaches  INTEGER NOT NULL DEFAULT 0,
  last_window_end_ms    BIGINT NOT NULL,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.oracle_breach_streaks IS
  'Oracle-owned (S7-T09): consecutive in-breach 6h windows per ServerStake. Sole writer is apps/quality-oracle. Not a chain mirror.';

-- Service-role only: this is internal oracle bookkeeping, not public data.
ALTER TABLE public.oracle_breach_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages oracle_breach_streaks"
  ON public.oracle_breach_streaks
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
