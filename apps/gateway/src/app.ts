/**
 * Hono app. Exported separately from index.ts so tests can build an app over
 * an in-memory store + injected facilitator (same pattern as the facilitator
 * service).
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { extractApiKey, authenticate } from './auth.js';
import {
  handleMcpRequest,
  handleStreamingToolsCall,
  type GatewayDeps,
} from './handler.js';
import { GatewayError } from './errors.js';

export function createApp(deps: GatewayDeps): Hono {
  const app = new Hono();
  app.use('*', cors());

  app.get('/health', (c) => c.json({ status: 'ok', service: 'gateway' }));

  app.post('/', async (c) => {
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json(
        { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
        400,
      );
    }

    let auth;
    try {
      const apiKey = extractApiKey(c.req.raw.headers);
      auth = await authenticate(apiKey, deps.store, deps.cache);
    } catch (e) {
      const ge =
        e instanceof GatewayError
          ? e
          : new GatewayError('auth failed', 'auth_required');
      return c.json(
        { jsonrpc: '2.0', id: (body.id as string | number | null) ?? null, error: ge.toJsonRpcError() },
        401,
      );
    }

    const intentId = c.req.header('x-mcpx-intent-id');
    const category = c.req.header('x-mcpx-category');
    const meta = {
      ...(intentId ? { intentId } : {}),
      ...(category ? { category } : {}),
    };

    // Pay-per-output streaming (S7-T04): a `tools/call` with
    // `Accept: text/event-stream` streams chunks back over SSE and settles
    // the metered actual via the facilitator `upto` path on stream close.
    const wantsStream = (c.req.header('accept') ?? '')
      .toLowerCase()
      .includes('text/event-stream');
    if (wantsStream && body.method === 'tools/call') {
      return handleStreamingToolsCall(
        (body.params as Record<string, unknown>) ?? {},
        auth,
        deps,
        meta,
        c.req.raw.signal,
      );
    }

    const res = await handleMcpRequest(body, auth, deps, meta);
    return c.json(res);
  });

  return app;
}
