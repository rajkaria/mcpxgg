/**
 * sui-defi-data anchor server entrypoint. Listens for MCP JSON-RPC; the
 * gateway forwards calls here after settlement.
 */

import { createSuiDefiDataServer } from './server.js';

const port = Number.parseInt(process.env.PORT ?? '3011', 10);

createSuiDefiDataServer()
  .listen(port)
  .then(() => {
    console.log(`[sui-defi-data] listening on :${port}`);
  })
  .catch((e: unknown) => {
    console.error('[sui-defi-data] boot failed:', e);
    process.exit(1);
  });
