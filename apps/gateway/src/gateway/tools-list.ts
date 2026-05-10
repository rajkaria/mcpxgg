import { createAdminClient } from "@/lib/supabase/admin";
import { cacheGet, cacheSet } from "@/lib/cache/upstash";

const TOOLS_LIST_CACHE_TTL = 300; // 5 minutes

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * The built-in mcpx_discover tool definition.
 * Allows users to search for and enable new MCP servers from the marketplace.
 */
const DISCOVER_TOOL: ToolDefinition = {
  name: "mcpx_discover",
  description:
    "Search the MCPX marketplace for MCP servers. Use this to find and enable new tools. " +
    "Free users get 10 searches per week, then 1 credit per search.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query to find MCP servers (e.g. 'weather', 'email', 'database')",
      },
    },
    required: ["query"],
  },
};

/**
 * Returns the full tools list for a user, including:
 * - All tools from servers the user has enabled (prefixed with namespace)
 * - The built-in mcpx_discover tool
 *
 * Results are cached per user for 300s.
 */
export async function getToolsList(userId: string): Promise<ToolDefinition[]> {
  const cacheKey = `tools_list:${userId}`;
  const cached = await cacheGet<ToolDefinition[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const supabase = createAdminClient();

  // Query user's enabled servers with their tools
  const { data, error } = await supabase
    .from("user_enabled_servers")
    .select(`
      server_id,
      mcp_servers!inner (
        id,
        namespace,
        name,
        status,
        mcp_tools (
          tool_name,
          description,
          input_schema,
          is_enabled
        )
      )
    `)
    .eq("user_id", userId) as any;

  const tools: ToolDefinition[] = [];

  if (!error && data) {
    for (const row of data) {
      const server = row.mcp_servers as any;
      if (!server || server.status !== "active") continue;

      const serverTools = (server.mcp_tools || []) as any[];
      for (const tool of serverTools) {
        if (!tool.is_enabled) continue;

        tools.push({
          name: `${server.namespace}_${tool.tool_name}`,
          description: `[${server.name}] ${tool.description}`,
          inputSchema: tool.input_schema || { type: "object", properties: {} },
        });
      }
    }
  }

  // Always include the discover tool
  tools.push(DISCOVER_TOOL);

  await cacheSet(cacheKey, tools, TOOLS_LIST_CACHE_TTL);
  return tools;
}
