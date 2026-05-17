/**
 * apps/quality-oracle — S6-T18.
 *
 * Two modes:
 *   `tsx src/index.ts run-once`  — compute + attest the single most-recent
 *                                  closed 6h window, then exit. Used by CI,
 *                                  a cron, or a manual backfill.
 *   `tsx src/index.ts`           — long-running loop: every pollInterval,
 *                                  attest each *not-yet-attested* closed 6h
 *                                  window (UTC-anchored floor(now/6h)·6h).
 *
 * The compute core (oracle.ts) is pure and unit-tested offline; this file is
 * the only place that boots real Supabase + chain deps.
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { initSentry } from '@mcpxgg/shared';
import { loadEnv } from './env.js';
import { createLogger, type Logger } from './logger.js';
import {
  createSupabaseQualityStore,
  createSupabaseStakeStore,
  createSupabaseBreachStreakStore,
} from './store.js';
import { createChainClient, createSlashChainClient } from './chain.js';
import {
  priorClosedWindow,
  runQualityOracle,
  runSlaSlashing,
  WINDOW_MS,
  type BreachStreakStore,
  type QualityChainClient,
  type QualityStore,
  type SlashChainClient,
  type StakeStore,
} from './oracle.js';

export interface OracleDeps {
  store: QualityStore;
  chain: QualityChainClient;
  /** S7-T09: SLA-staking slash deps. Omit to skip the slash pass. */
  stakeStore?: StakeStore;
  streakStore?: BreachStreakStore;
  slashChain?: SlashChainClient;
}

/** One closed-window pass: quality attest, then SLA-stake slashing. */
export async function runOnce(
  deps: OracleDeps,
  nowMs: number,
  logger: Logger,
): Promise<{ endMs: number }> {
  const { startMs, endMs } = priorClosedWindow(nowMs);

  // Pull the window samples once and feed both passes (avoids a double scan).
  const samples = await deps.store.getCallSamples(startMs, endMs);
  const sampleStore: QualityStore = { getCallSamples: async () => samples };

  const res = await runQualityOracle(sampleStore, deps.chain, startMs, endMs);
  logger.info(
    {
      window: [startMs, endMs],
      servers: res.serversMeasured,
      attested: res.attestationsSubmitted,
      failures: res.failures.length,
    },
    'quality-oracle: quality pass complete',
  );
  if (res.failures.length > 0) {
    logger.warn({ failures: res.failures }, 'quality-oracle: some attestations failed');
  }

  if (deps.stakeStore && deps.streakStore && deps.slashChain) {
    const slash = await runSlaSlashing(
      deps.stakeStore,
      deps.streakStore,
      deps.slashChain,
      samples,
      startMs,
      endMs,
    );
    logger.info(
      {
        window: [startMs, endMs],
        stakes: slash.stakesEvaluated,
        inBreach: slash.inBreach,
        slashed: slash.slashesSubmitted,
        slashedAtomic: slash.slashedAtomicTotal.toString(),
        failures: slash.failures.length,
      },
      'quality-oracle: SLA-slash pass complete',
    );
    if (slash.failures.length > 0) {
      logger.warn({ failures: slash.failures }, 'quality-oracle: some slashes failed');
    }
  }

  return { endMs };
}

/**
 * Loop body: attest the prior closed window iff it hasn't been attested yet.
 * `nowMs` injected for testability. Returns the boundary it attested, or
 * null if the current window was already done.
 */
export async function loopTick(
  deps: OracleDeps,
  lastAttestedBoundaryMs: number,
  nowMs: number,
  logger: Logger,
): Promise<{ attestedBoundaryMs: number } | null> {
  const { endMs } = priorClosedWindow(nowMs);
  if (endMs <= lastAttestedBoundaryMs) return null;
  await runOnce(deps, nowMs, logger);
  return { attestedBoundaryMs: endMs };
}

async function main(): Promise<void> {
  await initSentry('quality-oracle');
  const env = loadEnv();
  if (env.testMode) {
    throw new Error('quality-oracle booted in MCPX_ORACLE_TEST_MODE=1 — refuse to run');
  }
  const logger = createLogger(false);
  const store = await createSupabaseQualityStore(env.supabaseUrl, env.supabaseServiceRoleKey);
  const chain = await createChainClient({
    packageId: env.mcpxPackageId,
    rpcUrl: env.suiRpcUrl,
    oracleCapId: env.oracleCapId,
    oraclePrivateKey: env.oraclePrivateKey,
  });
  const stakeStore = await createSupabaseStakeStore(
    env.supabaseUrl,
    env.supabaseServiceRoleKey,
  );
  const streakStore = await createSupabaseBreachStreakStore(
    env.supabaseUrl,
    env.supabaseServiceRoleKey,
  );
  const slashChain = await createSlashChainClient({
    packageId: env.mcpxPackageId,
    rpcUrl: env.suiRpcUrl,
    oracleCapId: env.oracleCapId,
    oraclePrivateKey: env.oraclePrivateKey,
    coinType: env.usdsuiCoinType,
    insurancePoolId: env.insurancePoolId,
  });
  const deps: OracleDeps = { store, chain, stakeStore, streakStore, slashChain };

  const mode = process.argv[2];
  if (mode === 'run-once') {
    await runOnce(deps, Date.now(), logger);
    return;
  }

  const ac = new AbortController();
  process.on('SIGTERM', () => ac.abort());
  process.on('SIGINT', () => ac.abort());

  const app = new Hono();
  app.get('/health', (c) => c.json({ status: 'ok' }));
  serve({ fetch: app.fetch, port: env.healthPort });
  logger.info({ port: env.healthPort, windowMs: WINDOW_MS }, 'quality-oracle: loop starting');

  let lastBoundary = 0;
  while (!ac.signal.aborted) {
    try {
      const r = await loopTick(deps, lastBoundary, Date.now(), logger);
      if (r) lastBoundary = r.attestedBoundaryMs;
    } catch (e) {
      logger.error({ err: String(e) }, 'quality-oracle: tick failed; backing off');
    }
    await sleep(env.pollIntervalMs, ac.signal);
  }
  logger.info({}, 'quality-oracle: stopped');
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });
}

// Only auto-run when invoked as the entrypoint (not when imported by tests).
const isEntry =
  process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isEntry) {
  main().catch((e) => {
    console.error('quality-oracle boot failed:', e);
    process.exit(1);
  });
}
