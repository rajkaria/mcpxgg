// ---------------------------------------------------------------------------
// MCPX Starter Template - MCP Protocol Handler
// ---------------------------------------------------------------------------
// Implements the subset of the Model Context Protocol (JSON-RPC 2.0) that the
// MCPX gateway expects:
//
//   initialize   - handshake with capabilities
//   ping         - health-check
//   tools/list   - enumerate available tools
//   tools/call   - execute a specific tool
// ---------------------------------------------------------------------------

import type { McpRequest, McpResponse } from "./types.js";
import { getTools, getTool } from "./tool-registry.js";
import { validateInput } from "./validation.js";

// ---------------------------------------------------------------------------
// Server metadata - customise these to match your server
// ---------------------------------------------------------------------------
const SERVER_INFO = {
  name: "mcpx-mcp-server",
  version: "1.0.0",
};

const CAPABILITIES = {
  tools: { listChanged: false },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ok(id: string | number | undefined, result: unknown): McpResponse {
  return { jsonrpc: "2.0", id, result };
}

function err(
  id: string | number | undefined,
  code: number,
  message: string,
  data?: unknown,
): McpResponse {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}

// ---------------------------------------------------------------------------
// Method handlers
// ---------------------------------------------------------------------------

function handleInitialize(req: McpRequest): McpResponse {
  return ok(req.id, {
    protocolVersion: "2024-11-05",
    serverInfo: SERVER_INFO,
    capabilities: CAPABILITIES,
  });
}

function handlePing(req: McpRequest): McpResponse {
  return ok(req.id, {});
}

function handleToolsList(req: McpRequest): McpResponse {
  const tools = getTools().map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
  return ok(req.id, { tools });
}

async function handleToolsCall(req: McpRequest): Promise<McpResponse> {
  const params = req.params ?? {};
  const toolName = params.name as string | undefined;

  if (!toolName) {
    return err(req.id, -32602, "Missing required parameter: name");
  }

  const tool = getTool(toolName);
  if (!tool) {
    return err(req.id, -32602, `Unknown tool: ${toolName}`);
  }

  const args = (params.arguments ?? {}) as Record<string, unknown>;

  // Validate input against the tool's schema
  const validation = validateInput(tool.inputSchema, args);
  if (!validation.valid) {
    return err(req.id, -32602, "Invalid tool arguments", {
      errors: validation.errors,
    });
  }

  // Execute with a timeout
  const timeoutMs = (tool.timeoutSeconds ?? 30) * 1000;

  try {
    const result = await Promise.race([
      tool.execute(args),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Tool execution timed out")), timeoutMs),
      ),
    ]);

    return ok(req.id, {
      content: [{ type: "text", text: result }],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return ok(req.id, {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    });
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Route an incoming MCP JSON-RPC request to the appropriate handler.
 */
export async function handleMcpRequest(body: McpRequest): Promise<McpResponse> {
  // Basic JSON-RPC validation
  if (body.jsonrpc !== "2.0") {
    return err(body.id, -32600, "Invalid JSON-RPC version");
  }

  if (!body.method || typeof body.method !== "string") {
    return err(body.id, -32600, "Missing or invalid method");
  }

  switch (body.method) {
    case "initialize":
      return handleInitialize(body);
    case "ping":
      return handlePing(body);
    case "tools/list":
      return handleToolsList(body);
    case "tools/call":
      return await handleToolsCall(body);
    default:
      return err(body.id, -32601, `Method not found: ${body.method}`);
  }
}
