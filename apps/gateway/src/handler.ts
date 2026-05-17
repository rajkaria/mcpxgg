/**
 * MCP JSON-RPC handler. Full chain-backed tools/call flow (S3-T01..T07):
 *
 *   auth → resolve server+tool → free-tier decision → preflight →
 *   execute upstream → (success only) archive to Walrus → settle via
 *   facilitator → inject _meta.receipt.
 *
 * Settlement happens AFTER a successful server response. A server error means
 * no settlement and no charge. A settle failure after a successful response
 * is logged + retried (best effort) and surfaced as settlement:'pending' —
 * the response is still returned (the work was done).
 */

import { FacilitatorClient } from '@mcpxgg/x402';
import type { WalrusClient } from '@mcpxgg/walrus';
import type { GatewayEnv } from './env.js';
import type { Logger } from './logger.js';
import type { GatewayCache } from './cache/cache.js';
import type { AuthContext, GatewayStore } from './store/store.js';
import type { SessionSigner } from './settlement.js';
import { settle } from './settlement.js';
import { preflight } from './preflight.js';
import { executeTool } from './executor.js';
import { archiveCall } from './walrus-archive.js';
import { buildReceiptMeta } from './meta.js';
import { GatewayError, makeToolErrorContent } from './errors.js';

export interface GatewayDeps {
  env: GatewayEnv;
  store: GatewayStore;
  cache: GatewayCache;
  facilitator: FacilitatorClient;
  signer: SessionSigner;
  walrus: WalrusClient;
  logger: Logger;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const PROTOCOL_VERSION = '2025-03-26';
const FREE_TIER_TTL_SECONDS = 60 * 60 * 24 * 30;

function parseToolName(full: string): { namespace: string; toolName: string } {
  const idx = full.indexOf('_');
  if (idx === -1) return { namespace: full, toolName: full };
  return { namespace: full.slice(0, idx), toolName: full.slice(idx + 1) };
}

export async function handleMcpRequest(
  req: JsonRpcRequest,
  auth: AuthContext,
  deps: GatewayDeps,
): Promise<JsonRpcResponse> {
  const id = req.id ?? null;
  try {
    switch (req.method) {
      case 'initialize':
        return ok(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'mcpx-gateway', version: '0.2.0' },
        });
      case 'ping':
      case 'notifications/initialized':
        return ok(id, {});
      case 'tools/list':
        return ok(id, { tools: await listTools(auth, deps) });
      case 'tools/call':
        return await handleToolsCall(id, req.params ?? {}, auth, deps);
      default:
        return err(id, -32601, `Method not found: ${req.method}`);
    }
  } catch (e) {
    if (e instanceof GatewayError) {
      return { jsonrpc: '2.0', id, error: e.toJsonRpcError() };
    }
    deps.logger.error({ err: String(e) }, 'gateway: unhandled');
    return err(id, -32603, 'Internal gateway error');
  }
}

async function listTools(
  auth: AuthContext,
  deps: GatewayDeps,
): Promise<Array<Record<string, unknown>>> {
  const servers = await deps.store.listScopedServers(auth);
  const out: Array<Record<string, unknown>> = [];
  for (const s of servers) {
    const tools = await deps.store.listTools(s.serverObjectId);
    for (const t of tools) {
      out.push({
        name: `${s.namespace}_${t.toolName}`,
        description: t.description,
        inputSchema: t.inputSchema,
        _meta: {
          price_atomic: t.priceAtomic.toString(),
          free_tier_calls_per_user: t.freeTierCallsPerUser,
        },
      });
    }
  }
  return out;
}

async function handleToolsCall(
  id: string | number | null,
  params: Record<string, unknown>,
  auth: AuthContext,
  deps: GatewayDeps,
): Promise<JsonRpcResponse> {
  const now = deps.now ?? Date.now;
  const fullName = params.name as string | undefined;
  const args = (params.arguments as Record<string, unknown>) ?? {};
  if (!fullName) return err(id, -32602, 'Missing params.name');

  const requestId = crypto.randomUUID();
  const { namespace, toolName } = parseToolName(fullName);

  const server = await deps.store.resolveServer(namespace);
  if (!server) return ok(id, makeToolErrorContent('server_not_found'));
  const tool = await deps.store.resolveTool(server.serverObjectId, toolName);
  if (!tool) return ok(id, makeToolErrorContent('tool_not_found'));

  // Free-tier decision (before charge): first N calls per user per tool are
  // not settled. Counter is advanced only after a successful call.
  const ftKey = `ft:${auth.userId}:${server.serverObjectId}:${toolName}`;
  let used = 0;
  if (tool.freeTierCallsPerUser > 0) {
    used = (await deps.cache.getJSON<number>(ftKey)) ?? 0;
  }
  const isFree = tool.freeTierCallsPerUser > 0 && used < tool.freeTierCallsPerUser;
  const chargeAtomic = isFree ? 0n : tool.priceAtomic;

  try {
    preflight({ auth, server, tool, chargeAtomic, nowMs: now() });
  } catch (e) {
    if (e instanceof GatewayError) {
      deps.logger.warn(
        { requestId, userId: auth.userId, tool: fullName, code: e.code },
        'gateway: preflight rejected',
      );
      return ok(id, makeToolErrorContent(e.code, e.message));
    }
    throw e;
  }

  // Execute upstream.
  let exec;
  try {
    exec = await executeTool(
      server,
      tool,
      args,
      { requestId, payerAddress: auth.ownerAddress },
      deps.fetchImpl,
    );
  } catch (e) {
    const code = e instanceof GatewayError ? e.code : 'server_error';
    const message = e instanceof Error ? e.message : 'server error';
    deps.logger.warn(
      { requestId, userId: auth.userId, tool: fullName, code },
      'gateway: upstream failed — not settling',
    );
    // Server error → NO settlement, NO free-tier consumption.
    return ok(id, makeToolErrorContent(code as GatewayError['code'], message));
  }

  // Success path. Archive request/response to Walrus (permanent).
  const blobId = await archiveCall(deps.walrus, {
    v: 1,
    namespace,
    toolName,
    userId: auth.userId,
    requestId,
    ts: now(),
    request: { arguments: args },
    response: { content: exec.content, isError: exec.isError },
  });
  if (!blobId) {
    deps.logger.warn({ requestId, tool: fullName }, 'gateway: walrus archive failed');
  }

  let settlement: 'settled' | 'pending' | 'free' = 'free';
  let txDigest: string | undefined;
  let receiptObjectId: string | undefined;

  if (isFree) {
    await deps.cache.setJSON(ftKey, used + 1, FREE_TIER_TTL_SECONDS);
  } else if (deps.env.settleAsync) {
    settlement = 'pending';
    void settle(deps.env, deps.facilitator, deps.signer, {
      auth,
      server,
      tool,
      chargeAtomic,
      success: !exec.isError,
      ...(blobId ? { receiptBlobId: blobId } : {}),
      nowMs: now(),
    }).then((o) => {
      if (!o.settled) {
        deps.logger.error(
          { requestId, tool: fullName, error: o.error },
          'gateway: async settlement failed',
        );
      }
    });
  } else {
    const outcome = await settle(deps.env, deps.facilitator, deps.signer, {
      auth,
      server,
      tool,
      chargeAtomic,
      success: !exec.isError,
      ...(blobId ? { receiptBlobId: blobId } : {}),
      nowMs: now(),
    });
    if (outcome.settled && outcome.result) {
      settlement = 'settled';
      txDigest = outcome.result.txDigest;
      receiptObjectId = outcome.result.receiptObjectId;
    } else {
      // Work was done but settlement failed after retry — surface as pending,
      // do not fail the response (S3-T07).
      settlement = 'pending';
      deps.logger.error(
        { requestId, tool: fullName, error: outcome.error, code: outcome.result?.errorCode },
        'gateway: settlement failed after successful response',
      );
    }
  }

  const receipt = buildReceiptMeta({
    env: deps.env,
    namespace,
    toolName,
    chargeAtomic,
    blobId,
    settlement,
    ...(txDigest ? { txDigest } : {}),
    ...(receiptObjectId ? { receiptObjectId } : {}),
  });

  deps.logger.info(
    {
      requestId,
      userId: auth.userId,
      tool: fullName,
      chargeAtomic: chargeAtomic.toString(),
      settlement,
      txDigest,
    },
    'gateway: call complete',
  );

  return ok(id, {
    content: exec.content,
    isError: exec.isError,
    _meta: { ...(exec._meta ?? {}), receipt },
  });
}

function ok(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}
function err(
  id: string | number | null,
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message } };
}
