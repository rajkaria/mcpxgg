import { AuthResult } from "@/lib/gateway/auth";
import { getToolsList } from "@/lib/gateway/tools-list";
import { parseToolName, resolveServer, resolveTool } from "@/lib/gateway/router";
import { executeTool, ExecutionResult } from "@/lib/gateway/executor";
import { GatewayError, makeToolErrorContent } from "@/lib/gateway/errors";
import { logRequest } from "@/lib/gateway/logging";
import { discover } from "@/lib/gateway/discover";
import { debitCredits, refundCredits } from "@/lib/billing/credits";
import { PLANS } from "@/lib/billing/plans";

interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

const PROTOCOL_VERSION = "2025-03-26";
const SERVER_NAME = "mcpx-gateway";
const SERVER_VERSION = "1.0.0";

/**
 * Main MCP protocol handler.
 * Dispatches by JSON-RPC method and returns a JSON-RPC response.
 */
export async function handleMcpRequest(
  request: JsonRpcRequest,
  auth: AuthResult
): Promise<JsonRpcResponse> {
  const { method, params, id } = request;

  try {
    switch (method) {
      case "initialize":
        return makeResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION,
          },
        });

      case "ping":
        return makeResult(id, {});

      case "notifications/initialized":
        // Client acknowledgment — no response body needed
        return makeResult(id, {});

      case "tools/list":
        return await handleToolsList(id, auth);

      case "tools/call":
        return await handleToolsCall(id, params || {}, auth);

      default:
        return makeError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err: any) {
    if (err instanceof GatewayError) {
      return {
        jsonrpc: "2.0",
        id: id ?? null,
        error: err.toJsonRpcError(),
      };
    }

    console.error("[gateway/handler] Unhandled error:", err);
    return makeError(id, -32603, "Internal gateway error");
  }
}

/**
 * tools/list — returns all tools available to the user.
 */
async function handleToolsList(
  id: string | number | null | undefined,
  auth: AuthResult
): Promise<JsonRpcResponse> {
  const tools = await getToolsList(auth.userId);
  return makeResult(id, { tools });
}

/**
 * tools/call — full execution flow:
 * 1. Parse tool name
 * 2. Handle discover tool specially
 * 3. Phone verification check
 * 4. Resolve server + tool
 * 5. Credit check + debit
 * 6. Execute
 * 7. Refund on error
 * 8. Log & return response with _meta
 */
async function handleToolsCall(
  id: string | number | null | undefined,
  params: Record<string, unknown>,
  auth: AuthResult
): Promise<JsonRpcResponse> {
  const toolName = params.name as string;
  const args = (params.arguments as Record<string, unknown>) || {};
  const startTime = Date.now();

  if (!toolName) {
    return makeError(id, -32602, "Missing required parameter: name");
  }

  // Handle built-in discover tool
  if (toolName === "mcpx_discover") {
    return await handleDiscover(id, args, auth, startTime);
  }

  // Parse the namespaced tool name
  const { namespace, toolName: localToolName } = parseToolName(toolName);

  // Resolve server
  const server = await resolveServer(namespace);
  if (!server) {
    logRequest({
      userId: auth.userId,
      toolName,
      namespace,
      creditCost: 0,
      latencyMs: Date.now() - startTime,
      status: "error",
      errorMessage: "Server not found",
    });
    return makeResult(id, makeToolErrorContent("server_not_found"));
  }

  // Resolve tool
  const tool = await resolveTool(server.id, localToolName);
  if (!tool) {
    logRequest({
      userId: auth.userId,
      serverId: server.id,
      toolName,
      namespace,
      creditCost: 0,
      latencyMs: Date.now() - startTime,
      status: "error",
      errorMessage: "Tool not found",
    });
    return makeResult(id, makeToolErrorContent("tool_not_found"));
  }

  // Phone verification check
  if (tool.requires_phone && !auth.phoneVerified) {
    logRequest({
      userId: auth.userId,
      serverId: server.id,
      toolId: tool.id,
      toolName,
      namespace,
      creditCost: 0,
      latencyMs: Date.now() - startTime,
      status: "error",
      errorMessage: "Phone verification required",
    });
    return makeResult(id, makeToolErrorContent("phone_required"));
  }

  // Credit check
  const cost = tool.credit_cost;
  if (cost > 0) {
    if (auth.creditBalance < cost) {
      logRequest({
        userId: auth.userId,
        serverId: server.id,
        toolId: tool.id,
        toolName,
        namespace,
        creditCost: 0,
        latencyMs: Date.now() - startTime,
        status: "error",
        errorMessage: "Insufficient credits",
      });
      return makeResult(id, makeToolErrorContent("insufficient_credits",
        `This tool costs ${cost} credit(s). Your balance: ${auth.creditBalance}.`
      ));
    }

    // Debit credits upfront
    await debitCredits({ userId: auth.userId, amount: cost, mcpServerId: server.id, toolName, description: `Tool call: ${toolName}` });
  }

  // Execute the tool
  let result: ExecutionResult;
  try {
    result = await executeTool(server, tool, args);
  } catch (execErr: any) {
    // Refund credits on execution error
    if (cost > 0) {
      await refundCredits({ userId: auth.userId, amount: cost, description: `Refund: ${toolName} error` }).catch((e: unknown) =>
        console.error("[gateway/handler] Refund failed:", e)
      );
    }

    const latencyMs = Date.now() - startTime;
    const errorCode = execErr instanceof GatewayError ? execErr.code : "server_error";

    logRequest({
      userId: auth.userId,
      serverId: server.id,
      toolId: tool.id,
      toolName,
      namespace,
      creditCost: 0, // refunded
      latencyMs,
      status: errorCode === "timeout" ? "timeout" : "error",
      errorMessage: execErr.message,
    });

    return makeResult(id, makeToolErrorContent(
      errorCode as any,
      execErr.message
    ));
  }

  // Log success
  const latencyMs = Date.now() - startTime;
  logRequest({
    userId: auth.userId,
    serverId: server.id,
    toolId: tool.id,
    toolName,
    namespace,
    creditCost: cost,
    latencyMs,
    status: "success",
  });

  // Return result with _meta
  return makeResult(id, {
    content: result.content,
    isError: result.isError || false,
    _meta: {
      server: server.namespace,
      tool: tool.tool_name,
      credits_used: cost,
      latency_ms: latencyMs,
      ...(result._meta || {}),
    },
  });
}

/**
 * Handles the built-in mcpx_discover tool.
 */
async function handleDiscover(
  id: string | number | null | undefined,
  args: Record<string, unknown>,
  auth: AuthResult,
  startTime: number
): Promise<JsonRpcResponse> {
  const query = args.query as string;

  try {
    const result = await discover(auth.userId, query, auth.creditBalance);

    logRequest({
      userId: auth.userId,
      toolName: "mcpx_discover",
      namespace: "mcpx",
      creditCost: result.credits_charged,
      latencyMs: Date.now() - startTime,
      status: "success",
    });

    // Format as tool response
    return makeResult(id, {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
      _meta: {
        credits_used: result.credits_charged,
        free_remaining: result.free_remaining,
        latency_ms: Date.now() - startTime,
      },
    });
  } catch (err: any) {
    logRequest({
      userId: auth.userId,
      toolName: "mcpx_discover",
      namespace: "mcpx",
      creditCost: 0,
      latencyMs: Date.now() - startTime,
      status: "error",
      errorMessage: err.message,
    });

    if (err instanceof GatewayError) {
      return makeResult(id, makeToolErrorContent(err.code, err.message));
    }

    return makeResult(id, makeToolErrorContent("server_error", err.message));
  }
}

// ============================================================
// Helpers
// ============================================================

function makeResult(id: string | number | null | undefined, result: unknown): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    result,
  };
}

function makeError(
  id: string | number | null | undefined,
  code: number,
  message: string
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message },
  };
}
