/**
 * Supabase-backed GatewayStore. Read-only against the indexer mirror
 * (migrations 006 + 007). `@supabase/supabase-js` is lazy-loaded so the test
 * path never needs it installed.
 *
 *   api key   → public.users(api_key) → user id
 *   session   → public.chain_balances(user_id, active) → Session mirror
 *   server    → public.mcp_servers(namespace, status='active')
 *   tool      → public.mcp_tools(server_id, tool_name)
 *
 * BIGINT columns arrive as strings (supabase-js would lose precision past
 * 2^53 as numbers); we BigInt() them at the boundary.
 */

import type {
  AuthContext,
  GatewayStore,
  ResolvedServer,
  ResolvedTool,
} from './store.js';

function big(v: unknown): bigint {
  if (v === null || v === undefined) return 0n;
  return BigInt(typeof v === 'number' ? Math.trunc(v) : String(v));
}

export async function createSupabaseStore(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<GatewayStore> {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // object_id → internal mcp_servers.id, learned during resolveServer.
  const uuidByObjectId = new Map<string, string>();

  return {
    async getAuthByApiKey(apiKey: string): Promise<AuthContext | null> {
      const { data: user } = (await sb
        .from('users')
        .select('id')
        .eq('api_key', apiKey)
        .single()) as { data: { id: string } | null };
      if (!user) return null;

      const { data: bal } = (await sb
        .from('chain_balances')
        .select(
          'session_object_id, owner_address, balance_atomic, per_call_cap_atomic, per_day_cap_atomic, today_spent_atomic, today_epoch_day, scoped_server_object_ids, active, expires_at_ms',
        )
        .eq('user_id', user.id)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()) as { data: Record<string, unknown> | null };
      if (!bal) return null;

      return {
        userId: user.id,
        apiKey,
        ownerAddress: String(bal.owner_address),
        sessionObjectId: String(bal.session_object_id),
        balanceAtomic: big(bal.balance_atomic),
        perCallCapAtomic: big(bal.per_call_cap_atomic),
        perDayCapAtomic: big(bal.per_day_cap_atomic),
        todaySpentAtomic: big(bal.today_spent_atomic),
        todayEpochDay:
          bal.today_epoch_day === null || bal.today_epoch_day === undefined
            ? null
            : Number(bal.today_epoch_day),
        scopedServerObjectIds: Array.isArray(bal.scoped_server_object_ids)
          ? (bal.scoped_server_object_ids as string[])
          : [],
        active: Boolean(bal.active),
        expiresAtMs:
          bal.expires_at_ms === null || bal.expires_at_ms === undefined
            ? null
            : Number(bal.expires_at_ms),
      };
    },

    async resolveServer(namespace: string): Promise<ResolvedServer | null> {
      const { data } = (await sb
        .from('mcp_servers')
        .select('id, object_id, namespace, endpoint_url, status')
        .eq('namespace', namespace)
        .eq('status', 'active')
        .maybeSingle()) as { data: Record<string, unknown> | null };
      if (!data || !data.object_id || !data.endpoint_url) return null;
      uuidByObjectId.set(String(data.object_id), String(data.id));
      return {
        serverObjectId: String(data.object_id),
        namespace: String(data.namespace),
        endpointUrl: String(data.endpoint_url),
        active: data.status === 'active',
      };
    },

    async resolveTool(
      serverObjectId: string,
      toolName: string,
    ): Promise<ResolvedTool | null> {
      const serverId = uuidByObjectId.get(serverObjectId);
      if (!serverId) return null;
      const { data } = (await sb
        .from('mcp_tools')
        .select(
          'tool_name, description, input_schema, price_atomic, free_tier_calls_per_user, timeout_seconds, is_enabled',
        )
        .eq('server_id', serverId)
        .eq('tool_name', toolName)
        .eq('is_enabled', true)
        .maybeSingle()) as { data: Record<string, unknown> | null };
      if (!data) return null;
      return {
        toolName: String(data.tool_name),
        description: String(data.description ?? ''),
        inputSchema:
          (data.input_schema as Record<string, unknown>) ?? { type: 'object' },
        priceAtomic: big(data.price_atomic),
        freeTierCallsPerUser: Number(data.free_tier_calls_per_user ?? 0),
        timeoutSeconds: Number(data.timeout_seconds ?? 30),
      };
    },

    async listTools(serverObjectId: string): Promise<ResolvedTool[]> {
      const serverId = uuidByObjectId.get(serverObjectId);
      if (!serverId) return [];
      const { data } = (await sb
        .from('mcp_tools')
        .select(
          'tool_name, description, input_schema, price_atomic, free_tier_calls_per_user, timeout_seconds',
        )
        .eq('server_id', serverId)
        .eq('is_enabled', true)) as { data: Array<Record<string, unknown>> | null };
      return (data ?? []).map((d) => ({
        toolName: String(d.tool_name),
        description: String(d.description ?? ''),
        inputSchema: (d.input_schema as Record<string, unknown>) ?? { type: 'object' },
        priceAtomic: big(d.price_atomic),
        freeTierCallsPerUser: Number(d.free_tier_calls_per_user ?? 0),
        timeoutSeconds: Number(d.timeout_seconds ?? 30),
      }));
    },

    async listScopedServers(auth: AuthContext): Promise<ResolvedServer[]> {
      const { data } = (await sb
        .from('mcp_servers')
        .select('id, object_id, namespace, endpoint_url, status')
        .eq('status', 'active')) as { data: Array<Record<string, unknown>> | null };
      const rows = (data ?? []).filter((d) => d.object_id && d.endpoint_url);
      for (const d of rows) uuidByObjectId.set(String(d.object_id), String(d.id));
      const allow =
        auth.scopedServerObjectIds.length === 0
          ? null
          : new Set(auth.scopedServerObjectIds);
      return rows
        .filter((d) => !allow || allow.has(String(d.object_id)))
        .map((d) => ({
          serverObjectId: String(d.object_id),
          namespace: String(d.namespace),
          endpointUrl: String(d.endpoint_url),
          active: true,
        }));
    },
  };
}
