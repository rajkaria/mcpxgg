/**
 * @mcpxgg/sdk — consumer SDK for calling MCP servers through mcpxgg.
 *
 * Wired in Sprint 6 (S6-T07). A thin JSON-RPC client over the gateway's
 * `tools/call`. Every call settles on-chain; the receipt is returned inline
 * from the gateway's `_meta.receipt`.
 *
 * Usage:
 *
 *   import { createMCPXClient } from '@mcpxgg/sdk';
 *
 *   const client = createMCPXClient({ apiKey: process.env.MCPX_API_KEY! });
 *   const result = await client.callTool('walrus-search_query', { q: 'sui' });
 *   console.log(result.data);
 *   console.log(result.receipt); // { txDigest, blobId, amountAtomic, chain }
 *
 * Agent (spending intent) usage — pass an intent id so the call settles
 * against a delegated, capped budget instead of the session's own caps:
 *
 *   const result = await client.callTool(
 *     'walrus-search_query',
 *     { q: 'sui' },
 *     { intentId: '0xintent...', category: 'intelligence' },
 *   );
 */

export const SDK_VERSION = '0.2.0';

export interface MCPXClientOptions {
  /** API key minted for an active session (mcpx_sk_...). */
  apiKey: string;
  /** Gateway base URL. Defaults to the public gateway. */
  baseUrl?: string;
  /**
   * Default spending-intent id applied to every `callTool` that does not
   * override it. Optional — omitted means session-cap settlement (today's
   * behaviour, fully backward compatible).
   */
  intentId?: string;
  /** Default category for intent scope checks. Optional. */
  category?: string;
  /** Injected fetch (tests / non-global-fetch runtimes). */
  fetchImpl?: typeof fetch;
  /** Per-call timeout in ms. Default 30_000. */
  timeoutMs?: number;
}

export interface CallToolOptions {
  /**
   * Spending-intent object id to settle this call against. When present the
   * SDK sends the `X-Mcpx-Intent-Id` header and the gateway routes settlement
   * through `settle_call_with_intent`. Omit for normal session settlement.
   */
  intentId?: string;
  /**
   * Tool category, forwarded as `X-Mcpx-Category`. Only meaningful with an
   * intent — the gateway checks it against the intent's `allowed_categories`.
   */
  category?: string;
}

export interface CallToolResult {
  data: unknown;
  /** True if the upstream tool reported an error (no settlement happened). */
  isError: boolean;
  receipt: {
    txDigest: string;
    blobId: string;
    amountAtomic: bigint;
    chain: string;
    /** 'settled' | 'pending' | 'free'. */
    settlement: string;
  };
}

export class MCPXError extends Error {
  /** Machine-readable gateway error code (e.g. `intent_revoked`). */
  code: string;
  /** JSON-RPC numeric code when the failure was protocol-level. */
  rpcCode?: number;

  constructor(message: string, code: string, rpcCode?: number) {
    super(message);
    this.name = 'MCPXError';
    this.code = code;
    if (rpcCode !== undefined) this.rpcCode = rpcCode;
  }
}

export interface MCPXClient {
  callTool(
    name: string,
    args?: Record<string, unknown>,
    options?: CallToolOptions,
  ): Promise<CallToolResult>;
}

const DEFAULT_BASE_URL = 'https://gateway.mcpx.gg';

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: {
    content?: unknown;
    isError?: boolean;
    _meta?: {
      error_code?: string;
      receipt?: {
        settlement?: string;
        tx_digest?: string;
        blob_id?: string;
        amount_atomic?: string;
        chain?: string;
      };
    };
  };
  error?: { code: number; message: string; data?: { error_code?: string } };
}

export function createMCPXClient(opts: MCPXClientOptions): MCPXClient {
  if (!opts.apiKey) throw new MCPXError('apiKey is required', 'auth_required');
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new MCPXError('no fetch implementation available', 'invalid_request');
  }
  const timeoutMs = opts.timeoutMs ?? 30_000;

  return {
    async callTool(name, args = {}, options = {}): Promise<CallToolResult> {
      const intentId = options.intentId ?? opts.intentId;
      const category = options.category ?? opts.category;

      const headers: Record<string, string> = {
        'content-type': 'application/json',
        authorization: `Bearer ${opts.apiKey}`,
      };
      if (intentId !== undefined) headers['x-mcpx-intent-id'] = intentId;
      if (category !== undefined) headers['x-mcpx-category'] = category;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetchImpl(`${baseUrl}/`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name, arguments: args },
          }),
          signal: controller.signal,
        });
      } catch (e) {
        throw new MCPXError(
          e instanceof Error ? e.message : 'network error',
          'connection_error',
        );
      } finally {
        clearTimeout(timer);
      }

      const text = await res.text();
      let body: JsonRpcResponse;
      try {
        body = JSON.parse(text) as JsonRpcResponse;
      } catch {
        throw new MCPXError(
          `gateway returned non-JSON (${res.status})`,
          'server_error',
        );
      }

      if (body.error) {
        throw new MCPXError(
          body.error.message,
          body.error.data?.error_code ?? 'server_error',
          body.error.code,
        );
      }

      const result = body.result;
      if (!result) {
        throw new MCPXError('gateway returned no result', 'server_error');
      }
      if (result.isError) {
        const code = result._meta?.error_code ?? 'server_error';
        const msg = extractText(result.content) ?? code;
        throw new MCPXError(msg, code);
      }

      const r = result._meta?.receipt ?? {};
      return {
        data: result.content,
        isError: false,
        receipt: {
          txDigest: r.tx_digest ?? '',
          blobId: r.blob_id ?? '',
          amountAtomic: BigInt(r.amount_atomic ?? '0'),
          chain: r.chain ?? '',
          settlement: r.settlement ?? 'unknown',
        },
      };
    },
  };
}

function extractText(content: unknown): string | undefined {
  if (Array.isArray(content)) {
    const first = content[0] as { text?: unknown } | undefined;
    if (first && typeof first.text === 'string') return first.text;
  }
  return undefined;
}
