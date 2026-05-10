/**
 * Gateway error types and JSON-RPC error response builders.
 */

export type GatewayErrorCode =
  | "timeout"
  | "connection_error"
  | "server_error"
  | "insufficient_credits"
  | "phone_required"
  | "server_not_enabled"
  | "tool_not_found"
  | "server_not_found"
  | "auth_required"
  | "invalid_api_key"
  | "rate_limited"
  | "invalid_request";

interface JsonRpcError {
  code: number;
  message: string;
  data?: Record<string, unknown>;
}

// Map gateway error codes to JSON-RPC numeric codes
const ERROR_CODE_MAP: Record<GatewayErrorCode, number> = {
  timeout: -32001,
  connection_error: -32002,
  server_error: -32003,
  insufficient_credits: -32004,
  phone_required: -32005,
  server_not_enabled: -32006,
  tool_not_found: -32007,
  server_not_found: -32008,
  auth_required: -32009,
  invalid_api_key: -32010,
  rate_limited: -32011,
  invalid_request: -32600,
};

// User-friendly error message templates
const ERROR_MESSAGES: Record<GatewayErrorCode, string> = {
  timeout: "The tool execution timed out. Please try again.",
  connection_error: "Could not connect to the MCP server. Please try again later.",
  server_error: "The MCP server encountered an error.",
  insufficient_credits: "Insufficient credits to execute this tool. Please add more credits.",
  phone_required: "Phone verification is required to use this tool. Please verify your phone number.",
  server_not_enabled: "This MCP server is not enabled. Use mcpx_discover to find and enable servers.",
  tool_not_found: "The requested tool was not found.",
  server_not_found: "The requested MCP server was not found.",
  auth_required: "Authentication is required. Please provide a valid API key.",
  invalid_api_key: "The provided API key is invalid.",
  rate_limited: "Rate limit exceeded. Please try again later.",
  invalid_request: "Invalid JSON-RPC request.",
};

export class GatewayError extends Error {
  code: GatewayErrorCode;
  details?: Record<string, unknown>;

  constructor(message: string, code: GatewayErrorCode, details?: Record<string, unknown>) {
    super(message);
    this.name = "GatewayError";
    this.code = code;
    this.details = details;
  }

  /**
   * Converts this error to a JSON-RPC error object.
   */
  toJsonRpcError(): JsonRpcError {
    return {
      code: ERROR_CODE_MAP[this.code],
      message: this.message || ERROR_MESSAGES[this.code],
      data: {
        error_code: this.code,
        ...this.details,
      },
    };
  }
}

/**
 * Creates a JSON-RPC error response from a GatewayErrorCode.
 */
export function makeJsonRpcError(
  code: GatewayErrorCode,
  customMessage?: string,
  details?: Record<string, unknown>
): JsonRpcError {
  return {
    code: ERROR_CODE_MAP[code],
    message: customMessage || ERROR_MESSAGES[code],
    data: {
      error_code: code,
      ...details,
    },
  };
}

/**
 * Wraps an error result in MCP tool response format (content array with isError).
 */
export function makeToolErrorContent(
  code: GatewayErrorCode,
  customMessage?: string
) {
  return {
    content: [
      {
        type: "text",
        text: customMessage || ERROR_MESSAGES[code],
      },
    ],
    isError: true,
    _meta: {
      error_code: code,
    },
  };
}
