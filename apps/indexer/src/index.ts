/**
 * apps/indexer — Sui events → Postgres mirror service.
 *
 * Sprint 2 (S2-T12..T24) wires:
 *   - subscribes to Sui events for the mcpx Move package
 *   - dedup via PRIMARY KEY on (tx_digest, event_seq)
 *   - upserts mirror tables: mcp_servers, request_log, chain_balances, developer_vaults
 *   - publishes Redis pub/sub messages for /live consumers
 *   - tracks last_processed_checkpoint for replay-safe restart
 */

console.error('indexer: scaffold only. See docs/SPRINTS.md Sprint 2 (S2-T12..T24).');
process.exit(1);
