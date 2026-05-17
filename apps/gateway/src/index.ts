/**
 * apps/gateway — MCP JSON-RPC gateway at mcp.mcpx.gg.
 *
 *   POST /      MCP JSON-RPC (initialize, ping, tools/list, tools/call)
 *   GET  /health
 *
 * Settles every paid call through the x402 facilitator, archives the
 * request/response to Walrus, and returns a verifiable _meta.receipt.
 */

import { serve } from '@hono/node-server';
import { FacilitatorClient } from '@mcpxgg/x402';
import { initSentry } from '@mcpxgg/shared';
import { createWalrusClient, walrusEnv } from '@mcpxgg/walrus';
import { createApp } from './app.js';
import { loadEnv } from './env.js';
import { createLogger } from './logger.js';
import { createMemoryCache, createRedisCache } from './cache/cache.js';
import { createSupabaseStore } from './store/supabase.js';
import { devSessionSigner } from './settlement.js';
import type { GatewayDeps } from './handler.js';

async function main(): Promise<void> {
  await initSentry('gateway');
  const env = loadEnv();
  if (env.testMode) {
    throw new Error('gateway booted with MCPX_GATEWAY_TEST_MODE=1 — refuse to serve real traffic');
  }
  const logger = createLogger(false);

  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required in prod');
  }
  const store = await createSupabaseStore(env.supabaseUrl, env.supabaseServiceRoleKey);
  const cache =
    env.redisUrl && env.redisToken
      ? await createRedisCache(env.redisUrl, env.redisToken)
      : createMemoryCache();
  const facilitator = new FacilitatorClient({ baseUrl: env.facilitatorUrl });
  const walrus = createWalrusClient(walrusEnv());

  const deps: GatewayDeps = {
    env,
    store,
    cache,
    facilitator,
    signer: devSessionSigner,
    walrus,
    logger,
  };

  const app = createApp(deps);
  logger.info({ port: env.port, network: env.network }, 'gateway: starting');
  serve({ fetch: app.fetch, port: env.port });
}

main().catch((e) => {
  console.error('gateway boot failed:', e);
  process.exit(1);
});
