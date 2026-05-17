/**
 * sui-identity MCP server (S6-T11/T12). Tools per spec §10.5:
 *   resolve_address    — SuiNS name (foo.sui) → owner address
 *   resolve_name       — address → primary SuiNS name
 *   verify_zklogin     — zkLogin proof envelope → { valid, issuer, sub-hash }
 *   address_reputation — address → reputation derived from CallReceipt count
 *
 * The SuiNS resolver, zkLogin verifier and reputation store are injected so
 * tests are hermetic and prod can swap in the real SuiNS indexer, the
 * canonical zkLogin verifier and the indexer Postgres mirror without touching
 * tool logic. The default factory boots fully offline (deterministic
 * resolvers) so it is demoable with zero config.
 *
 * Security: all three lookups take caller-supplied identifiers. Addresses and
 * names are validated against strict regexes before use; the zkLogin verifier
 * never echoes the raw `sub` (only a salted hash). `address_reputation` reads
 * the indexer *mirror* (rebuildable from chain), never the chain directly.
 */

import { createMCPXServer, type MCPXServer } from '@mcpxgg/server';
import {
  createOfflineReputationStore,
  createOfflineSuiNsResolver,
  createOfflineZkLoginVerifier,
  isSuiAddress,
  isSuiNsName,
  normalizeAddress,
  scoreFromReceipts,
  type ReputationStore,
  type SuiNsResolver,
  type ZkLoginProof,
  type ZkLoginVerifier,
} from './resolvers.js';

export interface SuiIdentityDeps {
  suins?: SuiNsResolver;
  zkLogin?: ZkLoginVerifier;
  reputation?: ReputationStore;
}

export function createSuiIdentityServer(deps: SuiIdentityDeps = {}): MCPXServer {
  const suins = deps.suins ?? createOfflineSuiNsResolver();
  const zkLogin = deps.zkLogin ?? createOfflineZkLoginVerifier();
  const reputation = deps.reputation ?? createOfflineReputationStore();

  const server = createMCPXServer({
    namespace: 'sui-identity',
    description:
      'zkLogin-aware identity resolver: SuiNS name ↔ address, zkLogin proof ' +
      'verification, and CallReceipt-derived address reputation.',
  });

  server.tool('resolve_address', {
    description: 'Resolve a SuiNS name (e.g. alice.sui) to its owner address.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'SuiNS name ending in .sui' },
      },
      required: ['name'],
    },
    pricing: { perCallAtomic: 1_000n, freeTierCallsPerUser: 5 },
    handler: async (args) => {
      const name = String(args.name ?? '').trim().toLowerCase();
      if (!name) throw new Error('name is required');
      if (!isSuiNsName(name)) {
        throw new Error('name is not a valid SuiNS name (expected e.g. alice.sui)');
      }
      const address = await suins.resolveAddress(name);
      return { name, address, resolved: address !== null };
    },
  });

  server.tool('resolve_name', {
    description: 'Resolve a Sui address to its primary SuiNS name, if any.',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Sui address (0x…)' },
      },
      required: ['address'],
    },
    pricing: { perCallAtomic: 1_000n, freeTierCallsPerUser: 5 },
    handler: async (args) => {
      const address = String(args.address ?? '').trim();
      if (!address) throw new Error('address is required');
      if (!isSuiAddress(address)) throw new Error('address is not a valid Sui address');
      const norm = normalizeAddress(address);
      const name = await suins.resolveName(norm);
      return { address: norm, name, resolved: name !== null };
    },
  });

  server.tool('verify_zklogin', {
    description:
      'Verify a zkLogin proof envelope. Returns { valid, issuer, subHash }. ' +
      'subHash is a salted hash of the OIDC subject — the raw subject is never ' +
      'returned.',
    inputSchema: {
      type: 'object',
      properties: {
        proof: {
          type: 'object',
          description: 'zkLogin proof: { issuer, sub, aud, proofPoints, ephemeralPublicKey }',
          properties: {
            issuer: { type: 'string' },
            sub: { type: 'string' },
            aud: { type: 'string' },
            proofPoints: { type: 'object' },
            ephemeralPublicKey: { type: 'string' },
          },
        },
      },
      required: ['proof'],
    },
    pricing: { perCallAtomic: 5_000n, freeTierCallsPerUser: 1 },
    timeoutSeconds: 30,
    handler: async (args) => {
      const proof = args.proof;
      if (!proof || typeof proof !== 'object' || Array.isArray(proof)) {
        throw new Error('proof must be an object');
      }
      const result = await zkLogin.verify(proof as ZkLoginProof);
      return {
        valid: result.valid,
        issuer: result.issuer,
        sub_hash: result.subHash,
        ...(result.reason ? { reason: result.reason } : {}),
      };
    },
  });

  server.tool('address_reputation', {
    description:
      'Reputation for a Sui address derived from its on-chain CallReceipt ' +
      'count (read from the indexer mirror). Higher receipt counts → higher ' +
      'score (0..100) and tier.',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Sui address (0x…)' },
      },
      required: ['address'],
    },
    pricing: { perCallAtomic: 2_000n, freeTierCallsPerUser: 3 },
    handler: async (args) => {
      const address = String(args.address ?? '').trim();
      if (!address) throw new Error('address is required');
      if (!isSuiAddress(address)) throw new Error('address is not a valid Sui address');
      const norm = normalizeAddress(address);
      const receiptCount = await reputation.receiptCount(norm);
      const { score, tier } = scoreFromReceipts(receiptCount);
      return {
        address: norm,
        receipt_count: receiptCount,
        score,
        tier,
        source: 'indexer-mirror',
      };
    },
  });

  return server;
}
