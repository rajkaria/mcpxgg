/**
 * sui-analytics anchor server entrypoint. Listens for MCP JSON-RPC; the
 * gateway forwards calls here after settlement. Boots fully offline with the
 * in-memory store + heuristic NL->SQL; set ANTHROPIC_API_KEY (and a real
 * store adapter) to upgrade.
 */

import { createSuiAnalyticsServer } from './server.js';

const port = Number.parseInt(process.env.PORT ?? '3012', 10);

createSuiAnalyticsServer()
  .listen(port)
  .then(() => {
    console.log(`[sui-analytics] listening on :${port}`);
  })
  .catch((e: unknown) => {
    console.error('[sui-analytics] boot failed:', e);
    process.exit(1);
  });
