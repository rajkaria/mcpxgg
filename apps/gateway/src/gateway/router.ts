import { createAdminClient } from "@/lib/supabase/admin";
import { cacheGet, cacheSet } from "@/lib/cache/upstash";

const SERVER_CACHE_TTL = 300; // 5 minutes
const TOOL_CACHE_TTL = 300; // 5 minutes

export interface ParsedToolName {
  namespace: string;
  toolName: string;
}

export interface McpServer {
  id: string;
  namespace: string;
  name: string;
  description: string;
  server_type: "internal" | "external";
  endpoint_url: string | null;
  internal_route: string | null;
  status: string;
}

export interface McpTool {
  id: string;
  server_id: string;
  tool_name: string;
  description: string;
  input_schema: Record<string, unknown>;
  credit_cost: number;
  requires_phone: boolean;
  is_enabled: boolean;
}

/**
 * Splits a fully-qualified tool name on the first underscore.
 * e.g. "weather_getForecast" → { namespace: "weather", toolName: "getForecast" }
 */
export function parseToolName(fullName: string): ParsedToolName {
  const idx = fullName.indexOf("_");
  if (idx === -1) {
    return { namespace: fullName, toolName: fullName };
  }
  return {
    namespace: fullName.substring(0, idx),
    toolName: fullName.substring(idx + 1),
  };
}

/**
 * Resolves a server by namespace. Cached for 300s.
 */
export async function resolveServer(namespace: string): Promise<McpServer | null> {
  const cacheKey = `server:${namespace}`;
  const cached = await cacheGet<McpServer>(cacheKey);
  if (cached) {
    return cached;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("mcp_servers")
    .select("id, namespace, name, description, server_type, endpoint_url, internal_route, status")
    .eq("namespace", namespace)
    .eq("status", "active")
    .single() as any;

  if (error || !data) {
    return null;
  }

  const server: McpServer = data as McpServer;
  await cacheSet(cacheKey, server, SERVER_CACHE_TTL);
  return server;
}

/**
 * Resolves a tool by server ID and tool name. Cached for 300s.
 */
export async function resolveTool(serverId: string, toolName: string): Promise<McpTool | null> {
  const cacheKey = `tool:${serverId}:${toolName}`;
  const cached = await cacheGet<McpTool>(cacheKey);
  if (cached) {
    return cached;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("mcp_tools")
    .select("id, server_id, tool_name, description, input_schema, credit_cost, requires_phone, is_enabled")
    .eq("server_id", serverId)
    .eq("tool_name", toolName)
    .eq("is_enabled", true)
    .single() as any;

  if (error || !data) {
    return null;
  }

  const tool: McpTool = data as McpTool;
  await cacheSet(cacheKey, tool, TOOL_CACHE_TTL);
  return tool;
}
