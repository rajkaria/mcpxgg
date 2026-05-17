/**
 * Gateway call wrapper (S7-T20).
 *
 * Thin reuse of `@mcpxgg/sdk`'s `createMCPXClient` so the widget never
 * re-implements the JSON-RPC / x402 settlement dance. The widget runs in a
 * third-party page with no server key, so it talks to the *public* gateway
 * with a per-session ephemeral key the host wallet has authorised.
 *
 * The tool name sent to the gateway is the fully-qualified `<server>_<tool>`
 * that the marketplace publishes (matching the SDK docstring example
 * `walrus-search_query`).
 */

import { createMCPXClient, MCPXError } from '@mcpxgg/sdk';
import type { CallToolResult } from '@mcpxgg/sdk';

/** Default public gateway — matches apps/web `NEXT_PUBLIC_GATEWAY_URL`. */
export const DEFAULT_GATEWAY_URL = 'https://mcp.mcpx.gg';

export interface WidgetCallInput {
  /** Marketplace namespace, e.g. `walrus-search`. */
  server: string;
  /** Tool name on that server, e.g. `query`. */
  tool: string;
  /** Tool arguments (parsed from the form / prefill JSON). */
  args: Record<string, unknown>;
  /** Session key the connected wallet authorised (mcpx_sk_...). */
  apiKey: string;
  /** Gateway base URL. Defaults to the public gateway. */
  gatewayUrl?: string;
  /** Injected fetch (tests / SSR). */
  fetchImpl?: typeof fetch;
}

export interface WidgetCallResult {
  /** Human-displayable text extracted from the tool content. */
  text: string;
  /** Raw tool content (whatever the server returned). */
  raw: unknown;
  txDigest: string;
  blobId: string;
  amountAtomic: bigint;
  chain: string;
  settlement: string;
}

/**
 * Fully-qualified tool id the gateway expects: `<server>_<tool>`.
 * Exported for unit testing.
 */
export function qualifiedToolName(server: string, tool: string): string {
  const s = server.trim();
  const t = tool.trim();
  if (!s) throw new MCPXError('server is required', 'invalid_request');
  if (!t) throw new MCPXError('tool is required', 'invalid_request');
  // Already qualified (`server_tool`) — don't double-prefix.
  return t.startsWith(`${s}_`) ? t : `${s}_${t}`;
}

/** Pull the first text blob out of an MCP `content` array. */
export function extractText(content: unknown): string {
  if (Array.isArray(content)) {
    const first = content[0] as { text?: unknown } | undefined;
    if (first && typeof first.text === 'string') return first.text;
  }
  if (typeof content === 'string') return content;
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
}

export async function callThroughGateway(
  input: WidgetCallInput,
): Promise<WidgetCallResult> {
  const name = qualifiedToolName(input.server, input.tool);
  const client = createMCPXClient({
    apiKey: input.apiKey,
    baseUrl: input.gatewayUrl ?? DEFAULT_GATEWAY_URL,
    ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {}),
  });
  const res: CallToolResult = await client.callTool(name, input.args);
  return {
    text: extractText(res.data),
    raw: res.data,
    txDigest: res.receipt.txDigest,
    blobId: res.receipt.blobId,
    amountAtomic: res.receipt.amountAtomic,
    chain: res.receipt.chain,
    settlement: res.receipt.settlement,
  };
}

/** Explorer link for a settled receipt (Sui mainnet/testnet agnostic). */
export function receiptExplorerUrl(txDigest: string): string {
  return `https://suiscan.xyz/tx/${encodeURIComponent(txDigest)}`;
}

export { MCPXError };
