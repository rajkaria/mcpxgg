#!/usr/bin/env node
/**
 * @mcpxgg/cli — npx mcpxgg publish.
 *
 * Wired in Sprint 5 with sub-tasks S5-T07..T13:
 *   - validate mcpx.config.json
 *   - check namespace uniqueness via Sui RPC
 *   - upload README + tool schemas to Walrus
 *   - build PTB calling mcpx::registry::publish_server
 *   - user signs via wallet (Privy embedded or external)
 *   - print server_object_id, tx digest, explorer URL on success
 */

console.error('mcpxgg CLI: scaffold only. See docs/SPRINTS.md Sprint 5 (S5-T07..T13).');
process.exit(1);
