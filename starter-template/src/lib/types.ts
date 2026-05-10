// ---------------------------------------------------------------------------
// MCPX Starter Template - Core Type Definitions
// ---------------------------------------------------------------------------

/**
 * A loose JSON Schema object used to describe tool input parameters.
 * Follows the JSON Schema specification (draft-07 or later).
 */
export type JsonSchema = Record<string, unknown>;

/**
 * Defines a single tool that the MCP server exposes.
 *
 * Tools are the primary unit of functionality.  Each tool has:
 *  - A unique `name` (snake_case by convention)
 *  - A human-readable `description`
 *  - A `creditCost` that determines how many MCPX credits are consumed
 *  - An optional `timeoutSeconds` (defaults to 30)
 *  - An `inputSchema` describing the expected JSON input
 *  - An async `execute` function that performs the work
 */
export interface ToolDefinition {
  name: string;
  description: string;
  creditCost: 1 | 3 | 10;
  timeoutSeconds?: number;
  inputSchema: JsonSchema;
  execute(args: Record<string, unknown>): Promise<string>;
}

/**
 * A JSON-RPC 2.0 request as defined by the MCP protocol.
 */
export interface McpRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * A JSON-RPC 2.0 response as defined by the MCP protocol.
 */
export interface McpResponse {
  jsonrpc: "2.0";
  id?: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}
