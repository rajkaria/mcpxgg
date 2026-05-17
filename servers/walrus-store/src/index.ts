/**
 * walrus-store anchor server entrypoint. Listens for MCP JSON-RPC; the
 * gateway forwards calls here after settlement. Boots fully offline with the
 * in-memory Walrus backend + in-memory catalog; set WALRUS_PUBLISHER_URL /
 * WALRUS_AGGREGATOR_URL to persist to a real Walrus network.
 */

import { createWalrusStoreServer } from './server.js';

const port = Number.parseInt(process.env.PORT ?? '3013', 10);

createWalrusStoreServer()
  .listen(port)
  .then(() => {
    console.log(`[walrus-store] listening on :${port}`);
  })
  .catch((e: unknown) => {
    console.error('[walrus-store] boot failed:', e);
    process.exit(1);
  });
