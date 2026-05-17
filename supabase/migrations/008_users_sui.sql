-- ============================================================
-- S4-T04: Privy / Sui identity columns on users
-- ============================================================
--
-- Privy (Sprint 4) replaces Supabase Auth as the login surface. Each user
-- gets a derived Sui address on first wallet sign-in. Postgres stays a
-- mirror (ADR-011): sui_address is the only chain-identity fact we cache
-- here so the gateway can map api_key → owner_address without a chain RPC.
--
-- migration_status tracks the Web2→Sui cutover for any pre-Privy account:
--   legacy    — created under Supabase Auth, no wallet yet
--   migrating — Privy linked, first Session not yet created
--   migrated  — has a derived Sui address + at least one Session
-- Fresh installs start at 'migrated' implicitly once sui_address is set.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sui_address TEXT,
  ADD COLUMN IF NOT EXISTS privy_did TEXT,
  ADD COLUMN IF NOT EXISTS migration_status TEXT NOT NULL DEFAULT 'legacy'
    CHECK (migration_status IN ('legacy', 'migrating', 'migrated'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_sui_address
  ON public.users(sui_address) WHERE sui_address IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_privy_did
  ON public.users(privy_did) WHERE privy_did IS NOT NULL;

COMMENT ON COLUMN public.users.sui_address IS
  'Privy-derived Sui address. Populated on first wallet sign-in (S4-T03).';
COMMENT ON COLUMN public.users.privy_did IS
  'Privy decentralized id (did:privy:...). Stable per user across logins.';
COMMENT ON COLUMN public.users.migration_status IS
  'Web2→Sui cutover state: legacy | migrating | migrated.';
