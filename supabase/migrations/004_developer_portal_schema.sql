CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES public.users(id),
  server_id UUID REFERENCES public.mcp_servers(id),
  amount NUMERIC(10,2) NOT NULL,
  razorpay_transfer_id TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'deferred')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  credits_consumed INTEGER,
  share_percentage NUMERIC(5,2),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_payouts_developer ON public.payouts(developer_id, created_at DESC);

CREATE TABLE public.review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.mcp_servers(id),
  developer_id UUID NOT NULL REFERENCES public.users(id),
  review_type TEXT NOT NULL CHECK (review_type IN ('spot_check', 'anomalous_free_traffic', 'reported', 'major_update')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'dismissed')),
  metadata JSONB DEFAULT '{}',
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX idx_review_queue_status ON public.review_queue(status) WHERE status = 'pending';

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Developers can view own payouts" ON public.payouts FOR SELECT USING (auth.uid() = developer_id);

ALTER TABLE public.review_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Developers can view own reviews" ON public.review_queue FOR SELECT USING (auth.uid() = developer_id);
