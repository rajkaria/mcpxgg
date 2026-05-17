/**
 * Gateway error types and JSON-RPC error response builders.
 *
 * Chain-backed model (Sprint 3): credits/phone are gone; settlement, session
 * balance and spending caps are the failure surface.
 */

export type GatewayErrorCode =
  | 'timeout'
  | 'connection_error'
  | 'server_error'
  | 'insufficient_balance'
  | 'per_call_cap_exceeded'
  | 'per_day_cap_exceeded'
  | 'server_not_scoped'
  | 'session_expired'
  | 'session_inactive'
  | 'server_not_found'
  | 'tool_not_found'
  | 'auth_required'
  | 'invalid_api_key'
  | 'settlement_failed'
  | 'platform_paused'
  | 'rate_limited'
  | 'invalid_request';

interface JsonRpcError {
  code: number;
  message: string;
  data?: Record<string, unknown>;
}

const ERROR_CODE_MAP: Record<GatewayErrorCode, number> = {
  timeout: -32001,
  connection_error: -32002,
  server_error: -32003,
  insufficient_balance: -32004,
  per_call_cap_exceeded: -32005,
  per_day_cap_exceeded: -32006,
  server_not_scoped: -32007,
  session_expired: -32008,
  session_inactive: -32009,
  server_not_found: -32010,
  tool_not_found: -32011,
  auth_required: -32012,
  invalid_api_key: -32013,
  settlement_failed: -32014,
  platform_paused: -32015,
  rate_limited: -32016,
  invalid_request: -32600,
};

const ERROR_MESSAGES: Record<GatewayErrorCode, string> = {
  timeout: 'The tool execution timed out. Please try again.',
  connection_error: 'Could not connect to the MCP server. Please try again later.',
  server_error: 'The MCP server encountered an error.',
  insufficient_balance:
    'Insufficient session balance. Recharge USDsui to your session to continue.',
  per_call_cap_exceeded: 'This call exceeds the per-call spending cap on your session.',
  per_day_cap_exceeded: 'This call would exceed the daily spending cap on your session.',
  server_not_scoped: 'Your scoped API key is not authorised to call this server.',
  session_expired: 'Your session has expired. Create a new session to continue.',
  session_inactive: 'Your session is inactive.',
  server_not_found: 'The requested MCP server was not found.',
  tool_not_found: 'The requested tool was not found.',
  auth_required: 'Authentication is required. Provide a valid API key.',
  invalid_api_key: 'The provided API key is invalid.',
  settlement_failed: 'On-chain settlement failed. The call was not charged.',
  platform_paused: 'The platform is temporarily paused. Please try again later.',
  rate_limited: 'Rate limit exceeded. Please try again later.',
  invalid_request: 'Invalid JSON-RPC request.',
};

export class GatewayError extends Error {
  code: GatewayErrorCode;
  details?: Record<string, unknown>;

  constructor(message: string, code: GatewayErrorCode, details?: Record<string, unknown>) {
    super(message);
    this.name = 'GatewayError';
    this.code = code;
    if (details) this.details = details;
  }

  toJsonRpcError(): JsonRpcError {
    return {
      code: ERROR_CODE_MAP[this.code],
      message: this.message || ERROR_MESSAGES[this.code],
      data: { error_code: this.code, ...this.details },
    };
  }
}

export function makeJsonRpcError(
  code: GatewayErrorCode,
  customMessage?: string,
  details?: Record<string, unknown>,
): JsonRpcError {
  return {
    code: ERROR_CODE_MAP[code],
    message: customMessage || ERROR_MESSAGES[code],
    data: { error_code: code, ...details },
  };
}

export function makeToolErrorContent(code: GatewayErrorCode, customMessage?: string) {
  return {
    content: [{ type: 'text', text: customMessage || ERROR_MESSAGES[code] }],
    isError: true,
    _meta: { error_code: code },
  };
}
