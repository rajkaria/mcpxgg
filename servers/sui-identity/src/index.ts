/**
 * sui-identity anchor server entrypoint. Listens for MCP JSON-RPC; the
 * gateway forwards calls here after settlement. Boots fully offline with
 * deterministic resolvers; set SUI_RPC_URL / SUINS_INDEXER_URL /
 * IDENTITY_PG_URL (and inject the prod adapters) to upgrade.
 */

import { createSuiIdentityServer } from './server.js';

const port = Number.parseInt(process.env.PORT ?? '3014', 10);

createSuiIdentityServer()
  .listen(port)
  .then(() => {
    console.log(`[sui-identity] listening on :${port}`);
  })
  .catch((e: unknown) => {
    console.error('[sui-identity] boot failed:', e);
    process.exit(1);
  });
