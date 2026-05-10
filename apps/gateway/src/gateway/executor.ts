import { McpServer, McpTool } from "@/lib/gateway/router";
import { getInternalHandler } from "@/lib/mcp-servers/registry";
import { GatewayError } from "@/lib/gateway/errors";

const EXTERNAL_TIMEOUT_MS = 30_000; // 30 seconds

export interface ExecutionResult {
  content: Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

/**
 * Executes a tool call against the appropriate server.
 * - Internal servers: dispatches to the in-process registry handler
 * - External servers: POSTs to the server's endpoint_url with a timeout
 */
export async function executeTool(
  server: McpServer,
  tool: McpTool,
  args: Record<string, unknown>
): Promise<ExecutionResult> {
  if (server.server_type === "internal") {
    return executeInternal(server, tool, args);
  } else {
    return executeExternal(server, tool, args);
  }
}

/**
 * Calls the in-process handler from the internal server registry.
 */
async function executeInternal(
  server: McpServer,
  tool: McpTool,
  args: Record<string, unknown>
): Promise<ExecutionResult> {
  const handler = getInternalHandler(server.namespace);
  if (!handler) {
    throw new GatewayError(
      `Internal server "${server.namespace}" has no registered handler`,
      "server_error"
    );
  }

  try {
    const result = await handler(tool.tool_name, args);
    return result as ExecutionResult;
  } catch (err: any) {
    throw new GatewayError(
      `Internal server error: ${err.message || "Unknown error"}`,
      "server_error"
    );
  }
}

/**
 * POSTs to the external server's endpoint_url with a timeout.
 */
async function executeExternal(
  server: McpServer,
  tool: McpTool,
  args: Record<string, unknown>
): Promise<ExecutionResult> {
  if (!server.endpoint_url) {
    throw new GatewayError(
      `External server "${server.namespace}" has no endpoint URL configured`,
      "server_error"
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXTERNAL_TIMEOUT_MS);

  try {
    const response = await fetch(server.endpoint_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: tool.tool_name,
          arguments: args,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new GatewayError(
        `External server returned status ${response.status}`,
        "server_error"
      );
    }

    const body = await response.json() as any;

    // Handle JSON-RPC response format
    if (body.error) {
      throw new GatewayError(
        body.error.message || "External server error",
        "server_error"
      );
    }

    // Return the result, normalizing to our ExecutionResult shape
    const result = body.result || body;
    return {
      content: result.content || [{ type: "text", text: JSON.stringify(result) }],
      isError: result.isError || false,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err instanceof GatewayError) throw err;

    if (err.name === "AbortError") {
      throw new GatewayError(
        `External server "${server.namespace}" timed out after ${EXTERNAL_TIMEOUT_MS}ms`,
        "timeout"
      );
    }

    throw new GatewayError(
      `Failed to connect to external server "${server.namespace}": ${err.message}`,
      "connection_error"
    );
  }
}
