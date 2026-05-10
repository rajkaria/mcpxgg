-- =============================================================
-- Credit Ledger (append-only, source of truth for all credit movements)
-- =============================================================
CREATE TABLE public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Amount: positive = grant/top-up, negative = debit/expiration
  amount INTEGER NOT NULL,

  -- Type of transaction
  type TEXT NOT NULL CHECK (type IN (
    'grant',           -- Monthly plan credit grant
    'grant_signup',    -- Free tier initial grant
    'grant_upgrade',   -- Bonus credits from plan upgrade
    'topup',           -- PAYG purchase
    'debit',           -- MCP tool call consumption
    'expiration',      -- Expired credits (rollover cap excess, monthly reset, PAYG 12mo)
    'adjustment'       -- Manual admin adjustment (disputes, support)
  )),

  -- Description (human-readable, shown in billing history)
  description TEXT NOT NULL,

  -- Expiration tracking
  expires_at TIMESTAMPTZ,

  -- Remaining credits from this specific grant
  remaining INTEGER,

  -- Reference data
  razorpay_invoice_id TEXT,
  razorpay_payment_id TEXT,
  mcp_server_id UUID,
  tool_name TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_ledger_user ON public.credit_ledger(user_id, created_at DESC);
CREATE INDEX idx_credit_ledger_user_type ON public.credit_ledger(user_id, type);
CREATE INDEX idx_credit_ledger_remaining ON public.credit_ledger(user_id, expires_at ASC)
  WHERE remaining > 0;
CREATE INDEX idx_credit_ledger_mcp_server ON public.credit_ledger(mcp_server_id, created_at)
  WHERE mcp_server_id IS NOT NULL;

-- =============================================================
-- Stripe-related columns on users table
-- =============================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_subscription_status TEXT DEFAULT 'none'
    CHECK (razorpay_subscription_status IN ('none', 'active', 'past_due', 'canceled', 'halted')),
  ADD COLUMN IF NOT EXISTS credit_balance INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_cycle_anchor TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_credits_per_cycle INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS plan_rollover_cap INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_razorpay_customer ON public.users(razorpay_customer_id)
  WHERE razorpay_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_razorpay_subscription ON public.users(razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;

-- =============================================================
-- Row Level Security for credit_ledger
-- =============================================================
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit history"
  ON public.credit_ledger FOR SELECT
  USING (auth.uid() = user_id);
