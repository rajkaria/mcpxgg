-- ============================================================
-- S6-T06: gateway spending-intent validation read path
-- ============================================================
--
-- The gateway pre-validates a SpendingIntent before settlement (S6-T06). It
-- mirrors the on-chain `intent::record_spend` policy, so it needs the intent's
-- server scope and the per-UTC-day spend counter — fields the base `intents`
-- mirror (007) and 011 did not yet carry.
--
--   1. intents — add server_object_ids (scope allowlist),
--      today_spent_atomic + today_epoch_day (daily counter). All
--      nullable / defaulted so the existing frozen indexer upsert shape
--      still works; richer IntentCreated / IntentUsed handlers (S6-T04)
--      fill them.
--   2. intents_gateway — the exact read shape the gateway store consumes.
--      `revoked` is derived from `status` so the gateway never has to know
--      the mirror's tri-state status enum. server_object_ids /
--      allowed_categories coalesce to '{}' (= unscoped, the chain default).
--
-- MIRROR-ONLY (ADR-011): `intents` is written *exclusively* by apps/indexer
-- from on-chain Intent events. The gateway and route handlers read it (via
-- this view) and MUST never write it — the chain owns intent state.
-- ============================================================

ALTER TABLE public.intents
  ADD COLUMN IF NOT EXISTS server_object_ids  TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS today_spent_atomic BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS today_epoch_day    BIGINT;

COMMENT ON COLUMN public.intents.server_object_ids IS
  'Server-scope allowlist (object ids). Empty = any server. Mirror of SpendingIntent.server_ids; defaults ''{}'' until a richer IntentCreated event carries it.';
COMMENT ON COLUMN public.intents.today_spent_atomic IS
  'USDsui atomic spent against this intent in today_epoch_day. Mirror of SpendingIntent.today_spent_atomic, advanced by the IntentUsed handler (S6-T04).';
COMMENT ON COLUMN public.intents.today_epoch_day IS
  'UTC epoch day (ms/86_400_000) the today_spent_atomic counter belongs to. NULL until first use.';

-- Gateway read shape. revoked := status <> 'active' so a revoked OR expired
-- mirror row both surface as revoked/expired at the gateway (the gateway
-- additionally re-checks expiry against its own clock).
CREATE OR REPLACE VIEW public.intents_gateway AS
SELECT
  i.intent_object_id,
  i.agent_address,
  i.daily_cap_atomic,
  i.per_call_cap_atomic,
  COALESCE(i.server_object_ids, '{}')  AS server_object_ids,
  COALESCE(i.allowed_categories, '{}') AS allowed_categories,
  i.today_spent_atomic,
  i.today_epoch_day,
  i.expires_at_ms,
  (i.status = 'revoked')               AS revoked
FROM public.intents i;

COMMENT ON VIEW public.intents_gateway IS
  'Read shape for apps/gateway S6-T06 intent validation. revoked = status=''revoked''. Indexer-written source table only (ADR-011).';
