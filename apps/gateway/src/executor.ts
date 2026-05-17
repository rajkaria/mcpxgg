/**
 * Calls the upstream MCP server over JSON-RPC `tools/call`. Settlement
 * context (payer, tx digest, receipt blob) is injected as `X-Mcpx-*`
 * headers so SDK servers can attribute the call.
 */

import type { ResolvedServer, ResolvedTool } from './store/store.js';
import { GatewayError } from './errors.js';

export interface ExecutionResult {
  content: Array<{ type: string; text?: string; [k: string]: unknown }>;
  isError: boolean;
  _meta?: Record<string, unknown>;
}

export interface ExecutorContext {
  requestId: string;
  payerAddress: string;
}

export async function executeTool(
  server: ResolvedServer,
  tool: ResolvedTool,
  args: Record<string, unknown>,
  ctx: ExecutorContext,
  fetchImpl: typeof fetch = fetch,
): Promise<ExecutionResult> {
  const controller = new AbortController();
  const timeoutMs = tool.timeoutSeconds * 1000;
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(server.endpointUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-mcpx-request-id': ctx.requestId,
        'x-mcpx-payer': ctx.payerAddress,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: ctx.requestId,
        method: 'tools/call',
        params: { name: tool.toolName, arguments: args },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new GatewayError(
        `Server ${server.namespace} returned http ${res.status}`,
        'server_error',
      );
    }
    const body = (await res.json()) as {
      error?: { message?: string };
      result?: { content?: unknown; isError?: boolean; _meta?: Record<string, unknown> };
    };
    if (body.error) {
      throw new GatewayError(
        body.error.message ?? `Server ${server.namespace} error`,
        'server_error',
      );
    }
    const r = body.result ?? {};
    const content = Array.isArray(r.content)
      ? (r.content as ExecutionResult['content'])
      : [{ type: 'text', text: JSON.stringify(r) }];
    return {
      content,
      isError: r.isError === true,
      ...(r._meta ? { _meta: r._meta } : {}),
    };
  } catch (e) {
    if (e instanceof GatewayError) throw e;
    if (e instanceof Error && e.name === 'AbortError') {
      throw new GatewayError(
        `Server ${server.namespace} timed out after ${timeoutMs}ms`,
        'timeout',
      );
    }
    throw new GatewayError(
      `Failed to reach ${server.namespace}: ${e instanceof Error ? e.message : String(e)}`,
      'connection_error',
    );
  } finally {
    clearTimeout(t);
  }
}
