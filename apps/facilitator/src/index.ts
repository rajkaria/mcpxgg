/**
 * apps/facilitator — Sui x402 facilitator service.
 *
 * Endpoints (Sprint 2, S2-T01..T11):
 *   POST /verify    — validates payment payload signature, checks session balance + policies
 *   POST /settle    — builds PTB, signs as gas-station, submits to Sui RPC, awaits finality
 *   GET  /supported — returns supported schemes + networks
 *
 * Apache 2.0 — see LICENSE.
 */

console.error('facilitator: scaffold only. See docs/SPRINTS.md Sprint 2 (S2-T01..T11).');
process.exit(1);
