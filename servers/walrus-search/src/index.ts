/**
 * walrus-search anchor server entrypoint. Listens for MCP JSON-RPC; the
 * gateway forwards calls here after settlement.
 */

import { createWalrusSearchServer } from './server.js';

const port = Number.parseInt(process.env.PORT ?? '3010', 10);

createWalrusSearchServer()
  .listen(port)
  .then(() => {
    console.log(`[walrus-search] listening on :${port}`);
  })
  .catch((e: unknown) => {
    console.error('[walrus-search] boot failed:', e);
    process.exit(1);
  });
