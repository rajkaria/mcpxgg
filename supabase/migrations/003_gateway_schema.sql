-- ============================================================
-- SP3: MCP Gateway Schema
-- ============================================================

-- 1. MCP Servers (the registry of available MCP servers)
CREATE TABLE public.mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  namespace TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  long_description TEXT,
  icon_url TEXT,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  trigger_phrases TEXT[] DEFAULT '{}',
  server_type TEXT NOT NULL DEFAULT 'internal' CHECK (server_type IN ('internal', 'external')),
  endpoint_url TEXT,
  internal_route TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'active', 'suspended', 'archived')),
  is_featured BOOLEAN DEFAULT false,
  total_calls INTEGER DEFAULT 0,
  total_users INTEGER DEFAULT 0,
  avg_rating NUMERIC(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Indexes on mcp_servers
CREATE INDEX idx_mcp_servers_status ON public.mcp_servers(status);
CREATE INDEX idx_mcp_servers_namespace ON public.mcp_servers(namespace);
CREATE INDEX idx_mcp_servers_developer ON public.mcp_servers(developer_id);
CREATE INDEX idx_mcp_servers_category ON public.mcp_servers(category);
CREATE INDEX idx_mcp_servers_featured ON public.mcp_servers(is_featured) WHERE is_featured = true;
CREATE INDEX idx_mcp_servers_tags ON public.mcp_servers USING GIN(tags);
CREATE INDEX idx_mcp_servers_trigger_phrases ON public.mcp_servers USING GIN(trigger_phrases);

-- Full-text search index for discover
CREATE INDEX idx_mcp_servers_search ON public.mcp_servers USING GIN(
  to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(long_description, ''))
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_mcp_servers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mcp_servers_updated_at
  BEFORE UPDATE ON public.mcp_servers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mcp_servers_updated_at();


-- 2. MCP Tools (tools exposed by each server)
CREATE TABLE public.mcp_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  description TEXT NOT NULL,
  input_schema JSONB NOT NULL DEFAULT '{}',
  credit_cost INTEGER NOT NULL DEFAULT 1,
  requires_phone BOOLEAN DEFAULT false,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(server_id, tool_name)
);

-- Indexes on mcp_tools
CREATE INDEX idx_mcp_tools_server ON public.mcp_tools(server_id);
CREATE INDEX idx_mcp_tools_name ON public.mcp_tools(tool_name);
CREATE INDEX idx_mcp_tools_enabled ON public.mcp_tools(is_enabled) WHERE is_enabled = true;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_mcp_tools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mcp_tools_updated_at
  BEFORE UPDATE ON public.mcp_tools
  FOR EACH ROW
  EXECUTE FUNCTION public.update_mcp_tools_updated_at();


-- 3. User Enabled Servers (which servers a user has turned on)
CREATE TABLE public.user_enabled_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  server_id UUID NOT NULL REFERENCES public.mcp_servers(id) ON DELETE CASCADE,
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, server_id)
);

-- Indexes on user_enabled_servers
CREATE INDEX idx_user_enabled_servers_user ON public.user_enabled_servers(user_id);
CREATE INDEX idx_user_enabled_servers_server ON public.user_enabled_servers(server_id);


-- 4. Request Log (audit trail for every tool call)
CREATE TABLE public.request_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  server_id UUID REFERENCES public.mcp_servers(id) ON DELETE SET NULL,
  tool_id UUID REFERENCES public.mcp_tools(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  namespace TEXT NOT NULL,
  credit_cost INTEGER DEFAULT 0,
  latency_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout', 'refunded')),
  error_message TEXT,
  request_meta JSONB DEFAULT '{}',
  response_meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes on request_log
CREATE INDEX idx_request_log_user ON public.request_log(user_id);
CREATE INDEX idx_request_log_server ON public.request_log(server_id);
CREATE INDEX idx_request_log_created ON public.request_log(created_at DESC);
CREATE INDEX idx_request_log_status ON public.request_log(status);
CREATE INDEX idx_request_log_namespace ON public.request_log(namespace);


-- 5. Discover Usage (rate-limit tracking for the discover tool)
CREATE TABLE public.discover_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  credited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes on discover_usage
CREATE INDEX idx_discover_usage_user ON public.discover_usage(user_id);
CREATE INDEX idx_discover_usage_created ON public.discover_usage(created_at DESC);
CREATE INDEX idx_discover_usage_user_week ON public.discover_usage(user_id, created_at);


-- ============================================================
-- Row Level Security Policies
-- ============================================================

-- mcp_servers: anyone can read active servers, developers manage their own
ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active servers"
  ON public.mcp_servers FOR SELECT
  USING (status = 'active');

CREATE POLICY "Developers can manage their own servers"
  ON public.mcp_servers FOR ALL
  USING (developer_id = auth.uid())
  WITH CHECK (developer_id = auth.uid());

-- mcp_tools: anyone can read tools for active servers
ALTER TABLE public.mcp_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tools for active servers"
  ON public.mcp_tools FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mcp_servers
      WHERE id = mcp_tools.server_id AND status = 'active'
    )
  );

CREATE POLICY "Developers can manage tools for their servers"
  ON public.mcp_tools FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.mcp_servers
      WHERE id = mcp_tools.server_id AND developer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mcp_servers
      WHERE id = mcp_tools.server_id AND developer_id = auth.uid()
    )
  );

-- user_enabled_servers: users manage their own
ALTER TABLE public.user_enabled_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own enabled servers"
  ON public.user_enabled_servers FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- request_log: users can read their own logs
ALTER TABLE public.request_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own request logs"
  ON public.request_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert request logs"
  ON public.request_log FOR INSERT
  WITH CHECK (true);

-- discover_usage: users can read their own usage
ALTER TABLE public.discover_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own discover usage"
  ON public.discover_usage FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert discover usage"
  ON public.discover_usage FOR INSERT
  WITH CHECK (true);
