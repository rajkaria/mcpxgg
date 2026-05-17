/**
 * @mcpxgg/server public types.
 */

export interface ToolPricing {
  /** Per-call price in USDsui smallest units (6 decimals). */
  perCallAtomic: bigint;
  /** Calls per user that are free before settlement kicks in. */
  freeTierCallsPerUser?: number;
}

/** Context passed to a tool handler. Settlement fields are populated by the
 *  gateway *after* it settles on-chain and re-injects them as headers. When a
 *  server is hit directly (no gateway) they are undefined. */
export interface ToolContext {
  /** Sui address that paid for this call (from X-Mcpx-Payer). */
  payerAddress?: string;
  /** Settlement tx digest (from X-Mcpx-Tx-Digest). */
  txDigest?: string;
  /** Walrus blob id of the archived request/response (from X-Mcpx-Receipt-Blob). */
  receiptBlobId?: string;
  /** Correlates gateway logs with server logs (from X-Mcpx-Request-Id). */
  requestId: string;
}

export type ToolResult =
  | string
  | Record<string, unknown>
  | { content: Array<{ type: string; text?: string; [k: string]: unknown }>; isError?: boolean };

/**
 * One streamed unit of work. Each chunk is metered independently by the
 * gateway (S7-T04, pay-per-output). `text` is the payload; `priceAtomic`,
 * when set, overrides the tool's per-call price for *this chunk* (USDsui
 * 6-decimal atomic units). Omit it to charge the tool's per-call price
 * once per chunk.
 */
export interface ToolStreamChunk {
  text: string;
  /** Per-chunk price override in USDsui atomic units. */
  priceAtomic?: bigint;
  /** Optional structured metadata echoed back to the caller. */
  meta?: Record<string, unknown>;
}

/**
 * A streaming handler return. The SDK wraps each yielded chunk so the
 * gateway can meter per-output. Backward compatible: a handler may still
 * return a single `ToolResult` (non-iterable) and nothing changes.
 */
export type ToolStream = AsyncIterable<ToolStreamChunk>;

export type ToolHandler = (
  args: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<ToolResult> | ToolResult | ToolStream;

export interface ToolDefinition {
  description: string;
  inputSchema: Record<string, unknown>;
  pricing: ToolPricing;
  timeoutSeconds?: number;
  handler: ToolHandler;
}

export interface RegisteredTool extends Omit<ToolDefinition, 'handler'> {
  name: string;
}

export interface MCPXServerOptions {
  namespace: string;
  /** Optional server description for the registry manifest. */
  description?: string;
}

export interface ServerManifest {
  namespace: string;
  description: string;
  sdkVersion: string;
  tools: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    priceAtomic: string;
    freeTierCallsPerUser: number;
    timeoutSeconds: number;
  }>;
}
