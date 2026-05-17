/**
 * createMCPXServer — the developer-facing builder. Formalises the JSON-RPC
 * MCP shape the gateway speaks (see apps/gateway executor), plus a registry
 * manifest the CLI (`npx mcpxgg publish`, Sprint 5) reads to publish on-chain.
 *
 *   const server = createMCPXServer({ namespace: 'walrus-search' });
 *   server.tool('query', {
 *     description: 'Semantic search over an index',
 *     inputSchema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
 *     pricing: { perCallAtomic: 5_000n },
 *     handler: async (args, ctx) => ({ hits: [...] }),
 *   });
 *   server.listen(3000);
 */

import { Hono } from 'hono';
import type {
  MCPXServerOptions,
  RegisteredTool,
  ServerManifest,
  ToolContext,
  ToolDefinition,
  ToolResult,
  ToolStream,
  ToolStreamChunk,
} from './types.js';

export const SDK_VERSION = '0.2.0';

const PROTOCOL_VERSION = '2025-03-26';

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

function normalizeResult(r: ToolResult): {
  content: Array<{ type: string; text?: string; [k: string]: unknown }>;
  isError: boolean;
} {
  if (typeof r === 'string') {
    return { content: [{ type: 'text', text: r }], isError: false };
  }
  if (
    r &&
    typeof r === 'object' &&
    Array.isArray((r as { content?: unknown }).content)
  ) {
    const rr = r as {
      content: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };
    return { content: rr.content, isError: rr.isError ?? false };
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(r) }],
    isError: false,
  };
}

function isAsyncIterable(v: unknown): v is ToolStream {
  return (
    v != null &&
    typeof (v as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] ===
      'function'
  );
}

function chunkToSseData(c: ToolStreamChunk): string {
  return JSON.stringify({
    text: c.text,
    ...(c.priceAtomic !== undefined && { priceAtomic: c.priceAtomic.toString() }),
    ...(c.meta !== undefined && { meta: c.meta }),
  });
}

function ctxFromHeaders(h: Headers): ToolContext {
  const requestId = h.get('x-mcpx-request-id') ?? crypto.randomUUID();
  const payer = h.get('x-mcpx-payer');
  const tx = h.get('x-mcpx-tx-digest');
  const blob = h.get('x-mcpx-receipt-blob');
  return {
    requestId,
    ...(payer ? { payerAddress: payer } : {}),
    ...(tx ? { txDigest: tx } : {}),
    ...(blob ? { receiptBlobId: blob } : {}),
  };
}

export interface MCPXServer {
  readonly namespace: string;
  tool(name: string, def: ToolDefinition): MCPXServer;
  manifest(): ServerManifest;
  listTools(): RegisteredTool[];
  /** Hono fetch handler — mount anywhere or pass to @hono/node-server. */
  readonly fetch: (req: Request) => Response | Promise<Response>;
  listen(port: number): Promise<{ port: number; close: () => Promise<void> }>;
}

export function createMCPXServer(opts: MCPXServerOptions): MCPXServer {
  const tools = new Map<string, ToolDefinition>();
  const namespace = opts.namespace;

  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok', namespace }));

  app.get('/.well-known/mcpx.json', (c) => c.json(buildManifest()));

  app.post('/', async (c) => {
    let body: JsonRpcRequest;
    try {
      body = (await c.req.json()) as JsonRpcRequest;
    } catch {
      return c.json(rpcError(null, -32700, 'Parse error'), 400);
    }
    const id = body.id ?? null;

    switch (body.method) {
      case 'initialize':
        return c.json(
          rpcResult(id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: `mcpxgg/${namespace}`, version: SDK_VERSION },
          }),
        );
      case 'ping':
      case 'notifications/initialized':
        return c.json(rpcResult(id, {}));
      case 'tools/list':
        return c.json(
          rpcResult(id, {
            tools: listTools().map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: t.inputSchema,
            })),
          }),
        );
      case 'tools/call': {
        const params = body.params ?? {};
        const name = params.name as string | undefined;
        const args = (params.arguments as Record<string, unknown>) ?? {};
        if (!name) return c.json(rpcError(id, -32602, 'Missing params.name'), 400);
        const def = tools.get(name);
        if (!def) return c.json(rpcError(id, -32601, `Unknown tool: ${name}`), 404);

        const ctx = ctxFromHeaders(c.req.raw.headers);
        const timeoutMs = (def.timeoutSeconds ?? 30) * 1000;
        const wantsStream = (c.req.header('accept') ?? '')
          .toLowerCase()
          .includes('text/event-stream');
        let handlerOut: ToolResult | ToolStream;
        try {
          // The handler call itself is timed; an async iterator resolves
          // immediately (the time is spent draining it, bounded per-chunk
          // by the consumer / gateway, not here).
          handlerOut = await withTimeout(
            Promise.resolve(def.handler(args, ctx)),
            timeoutMs,
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return c.json(
            rpcResult(id, {
              content: [{ type: 'text', text: `Tool error: ${msg}` }],
              isError: true,
            }),
          );
        }

        if (isAsyncIterable(handlerOut)) {
          const stream = handlerOut;
          if (wantsStream) {
            // SSE: one `chunk` event per yielded unit so the gateway meters
            // per-output, then a terminal `done` event. Client/gateway abort
            // (request signal) stops iteration — finalize-on-close is the
            // gateway's job (S7-T04).
            const encoder = new TextEncoder();
            const body = new ReadableStream<Uint8Array>({
              async start(controller) {
                try {
                  for await (const chunk of stream) {
                    controller.enqueue(
                      encoder.encode(
                        `event: chunk\ndata: ${chunkToSseData(chunk)}\n\n`,
                      ),
                    );
                  }
                  controller.enqueue(
                    encoder.encode(`event: done\ndata: {}\n\n`),
                  );
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  controller.enqueue(
                    encoder.encode(
                      `event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`,
                    ),
                  );
                } finally {
                  controller.close();
                }
              },
            });
            return new Response(body, {
              headers: {
                'content-type': 'text/event-stream',
                'cache-control': 'no-cache',
                connection: 'keep-alive',
                'x-mcpx-stream': '1',
              },
            });
          }
          // Non-SSE caller but streaming handler: drain + concatenate so
          // legacy callers still get a single JSON-RPC result (backward
          // compatible). Whole drain is bounded by the handler timeout.
          try {
            const drain = (async () => {
              const parts: string[] = [];
              for await (const ch of stream) parts.push(ch.text);
              return parts;
            })();
            const parts = await withTimeout(drain, timeoutMs);
            return c.json(
              rpcResult(id, {
                content: parts.map((text) => ({ type: 'text', text })),
                isError: false,
              }),
            );
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            return c.json(
              rpcResult(id, {
                content: [{ type: 'text', text: `Tool error: ${msg}` }],
                isError: true,
              }),
            );
          }
        }

        return c.json(rpcResult(id, normalizeResult(handlerOut)));
      }
      default:
        return c.json(rpcError(id, -32601, `Method not found: ${body.method}`), 404);
    }
  });

  function listTools(): RegisteredTool[] {
    return [...tools.entries()].map(([name, d]) => ({
      name,
      description: d.description,
      inputSchema: d.inputSchema,
      pricing: d.pricing,
      ...(d.timeoutSeconds !== undefined ? { timeoutSeconds: d.timeoutSeconds } : {}),
    }));
  }

  function buildManifest(): ServerManifest {
    return {
      namespace,
      description: opts.description ?? `${namespace} MCP server`,
      sdkVersion: SDK_VERSION,
      tools: [...tools.entries()].map(([name, d]) => ({
        name,
        description: d.description,
        inputSchema: d.inputSchema,
        priceAtomic: d.pricing.perCallAtomic.toString(),
        freeTierCallsPerUser: d.pricing.freeTierCallsPerUser ?? 0,
        timeoutSeconds: d.timeoutSeconds ?? 30,
      })),
    };
  }

  const server: MCPXServer = {
    namespace,
    tool(name, def) {
      if (tools.has(name)) throw new Error(`tool "${name}" already registered`);
      tools.set(name, def);
      return server;
    },
    manifest: buildManifest,
    listTools,
    fetch: app.fetch,
    async listen(port) {
      const { serve } = await import('@hono/node-server');
      const instance = serve({ fetch: app.fetch, port });
      return {
        port,
        close: () =>
          new Promise<void>((resolve) => {
            (instance as { close: (cb: () => void) => void }).close(() => resolve());
          }),
      };
    },
  };
  return server;
}

function rpcResult(id: string | number | null, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}
function rpcError(id: string | number | null, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`handler timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
