/**
 * apps/indexer — Sui events → Postgres mirror service.
 *
 * Sprint 2 (S2-T12..T22). The runner is in `runner.ts`; this file boots
 * env, builds the real Sui + Supabase + Redis dependencies, and starts
 * the loop with a SIGTERM-aware AbortController.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { loadEnv } from './env.js';
import { createLogger } from './logger.js';
import { createSuiEventSource } from './event-source/sui-source.js';
import { createSupabaseStorage } from './storage/supabase.js';
import { NoopPubsub, createRedisPubsub } from './pubsub/pubsub.js';
import { run } from './runner.js';

async function main(): Promise<void> {
  const env = loadEnv();
  if (env.testMode) {
    throw new Error('indexer booted in MCPX_INDEXER_TEST_MODE=1 — refuse to run');
  }
  const logger = createLogger(false);
  const storage = await createSupabaseStorage(env.supabaseUrl, env.supabaseServiceRoleKey);
  const source = await createSuiEventSource(env);
  const pubsub =
    env.redisUrl && env.redisToken
      ? await createRedisPubsub(env.redisUrl, env.redisToken)
      : NoopPubsub;

  const ac = new AbortController();
  process.on('SIGTERM', () => ac.abort());
  process.on('SIGINT', () => ac.abort());

  const app = new Hono();
  app.get('/health', (c) => c.json({ status: 'ok' }));
  serve({ fetch: app.fetch, port: env.healthPort });
  logger.info({ port: env.healthPort }, 'indexer health endpoint listening');

  await run({
    storage,
    pubsub,
    source,
    pageSize: env.pageSize,
    pollIntervalMs: env.pollIntervalMs,
    logger,
    signal: ac.signal,
  });
}

main().catch((e) => {
  console.error('indexer boot failed:', e);
  process.exit(1);
});
