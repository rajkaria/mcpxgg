/**
 * Pay-per-output streaming (S7-T04).
 *
 * The gateway opens an SSE connection to the upstream MCP server (the
 * `@mcpxgg/server` SDK emits `event: chunk` / `event: done` when the request
 * carries `Accept: text/event-stream`), re-streams each chunk to the client,
 * and meters per-chunk. On stream close — normal completion OR early client
 * abort — it finalizes settlement via the facilitator `upto` path with the
 * summed metered actual and the originally-quoted ceiling. The contract
 * debits only the actual; the unused delta is never moved (implicit refund).
 *
 * The gateway never signs the settle PTB itself — finalize() delegates to
 * `settle()` → facilitator `/settle` (CLAUDE.md: never bypass the facilitator).
 */

import type { GatewayEnv } from './env.js';
import type { ResolvedServer, ResolvedTool } from './store/store.js';
import { GatewayError } from './errors.js';

export interface UpstreamChunk {
  text: string;
  /** Per-chunk price override (USDsui atomic units). */
  priceAtomic?: bigint;
  meta?: Record<string, unknown>;
}

export interface StreamExecContext {
  requestId: string;
  payerAddress: string;
}

/**
 * Open an SSE `tools/call` to the upstream server and yield decoded chunks.
 * Honours `signal` (client abort): aborting stops iteration promptly so the
 * caller can finalize with the partial metered amount.
 */
export async function* streamUpstream(
  server: ResolvedServer,
  tool: ResolvedTool,
  args: Record<string, unknown>,
  ctx: StreamExecContext,
  signal: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): AsyncGenerator<UpstreamChunk, void, void> {
  let res: Response;
  try {
    res = await fetchImpl(server.endpointUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        'x-mcpx-request-id': ctx.requestId,
        'x-mcpx-payer': ctx.payerAddress,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ctx.requestId,
        method: 'tools/call',
        params: { name: tool.toolName, arguments: args },
      }),
      signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return;
    throw new GatewayError(
      `Failed to reach ${server.namespace}: ${e instanceof Error ? e.message : String(e)}`,
      'connection_error',
    );
  }
  if (!res.ok) {
    throw new GatewayError(
      `Server ${server.namespace} returned http ${res.status}`,
      'server_error',
    );
  }
  if (!res.body) return;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      if (signal.aborted) break;
      let chunk;
      try {
        chunk = await reader.read();
      } catch (e) {
        if (signal.aborted || (e instanceof Error && e.name === 'AbortError')) break;
        throw e;
      }
      if (chunk.done) break;
      buf += decoder.decode(chunk.value, { stream: true });
      // SSE frames are separated by a blank line.
      let sep: number;
      while ((sep = buf.indexOf('\n\n')) !== -1) {
        const frame = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        const ev = parseSseFrame(frame);
        if (ev.event === 'done') return;
        if (ev.event === 'error') {
          throw new GatewayError(
            `Server ${server.namespace} stream error: ${ev.data}`,
            'server_error',
          );
        }
        if (ev.event === 'chunk' && ev.data) {
          yield decodeChunk(ev.data);
        }
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* already closed */
    }
  }
}

function parseSseFrame(frame: string): { event?: string; data?: string } {
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const raw of frame.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
  }
  return {
    ...(event !== undefined && { event }),
    ...(dataLines.length > 0 && { data: dataLines.join('\n') }),
  };
}

function decodeChunk(data: string): UpstreamChunk {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return { text: data };
  }
  if (parsed && typeof parsed === 'object') {
    const o = parsed as Record<string, unknown>;
    return {
      text: typeof o.text === 'string' ? o.text : JSON.stringify(o),
      ...(typeof o.priceAtomic === 'string' && /^[0-9]+$/.test(o.priceAtomic)
        ? { priceAtomic: BigInt(o.priceAtomic) }
        : {}),
      ...(o.meta && typeof o.meta === 'object'
        ? { meta: o.meta as Record<string, unknown> }
        : {}),
    };
  }
  return { text: String(parsed) };
}

/**
 * Per-stream meter. `quotedMax` is the ceiling the buyer signed; `perChunk`
 * is the default cost of a chunk that doesn't carry its own price. The meter
 * never lets the running total exceed `quotedMax` (it clamps and signals the
 * caller to stop) — the contract would reject actual > max anyway.
 */
export class StreamMeter {
  private total = 0n;
  private count = 0;
  constructor(
    readonly quotedMaxAtomic: bigint,
    private readonly perChunkAtomic: bigint,
  ) {}

  /** Record a chunk. Returns false if the ceiling is now reached (stop). */
  record(chunk: UpstreamChunk): boolean {
    const cost = chunk.priceAtomic ?? this.perChunkAtomic;
    if (this.total + cost > this.quotedMaxAtomic) {
      this.total = this.quotedMaxAtomic;
      this.count += 1;
      return false;
    }
    this.total += cost;
    this.count += 1;
    return true;
  }

  get meteredAtomic(): bigint {
    return this.total;
  }
  get chunkCount(): number {
    return this.count;
  }
}
