/**
 * apps/facilitator — Sui x402 facilitator service.
 *
 * Endpoints (Sprint 2, S2-T01..T11):
 *   GET  /supported — schemes, networks, token type, version
 *   POST /verify    — validates signature, session balance, spending policies
 *   POST /settle    — builds PTB, signs as gas-station, submits, awaits finality
 *   GET  /health    — liveness probe
 *   GET  /admin/gas-station — gas-station snapshot for monitoring
 *
 * Apache 2.0 — see LICENSE.
 */

import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { loadEnv } from './env.js';
import { GasStation } from './gas-station.js';
import { createLogger } from './logger.js';
import { createRealSuiBackend } from './sui/backend.js';

async function main(): Promise<void> {
  const env = loadEnv();
  if (env.testMode) {
    throw new Error(
      'facilitator booted in MCPX_FACILITATOR_TEST_MODE=1 — refuse to serve real traffic',
    );
  }
  const logger = createLogger(false);
  const backend = await createRealSuiBackend(env);
  const gasStation = new GasStation({
    ratePerMinute: env.gasStationRateLimitPerMin,
    dailyBudgetMist: env.gasStationDailyBudgetSui,
  });
  const app = createApp({ env, backend, gasStation, logger });
  logger.info(
    {
      port: env.port,
      network: env.network,
      packageId: env.mcpxPackageId,
    },
    'facilitator: starting',
  );
  serve({ fetch: app.fetch, port: env.port });
}

main().catch((e) => {
  console.error('facilitator boot failed:', e);
  process.exit(1);
});
