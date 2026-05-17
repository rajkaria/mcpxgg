/**
 * Identity resolution boundaries. Each is an interface so prod can swap in the
 * real SuiNS indexer, the canonical zkLogin proof verifier, and the indexer
 * Postgres mirror — without touching tool logic. The default factories are
 * deterministic and fully offline so tests + demo need zero network/config.
 *
 * Same boundary discipline as `packages/chain` (ChainAdapter): only the prod
 * adapter ever touches the network.
 */

import { createHash } from 'node:crypto';

const SUI_ADDR_RE = /^0x[0-9a-fA-F]{1,64}$/;
const SUINS_NAME_RE = /^[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})*\.sui$/;

export function isSuiAddress(s: string): boolean {
  return SUI_ADDR_RE.test(s);
}

export function isSuiNsName(s: string): boolean {
  return SUINS_NAME_RE.test(s);
}

/** Normalise an address to lowercase, zero-padded to 32 bytes (66 chars). */
export function normalizeAddress(s: string): string {
  const hex = s.slice(2).toLowerCase().padStart(64, '0');
  return `0x${hex}`;
}

export interface SuiNsResolver {
  /** SuiNS name (foo.sui) → owner address, or null if unregistered. */
  resolveAddress(name: string): Promise<string | null>;
  /** Address → its primary SuiNS name, or null if none set. */
  resolveName(address: string): Promise<string | null>;
}

/**
 * Deterministic offline SuiNS resolver. Names are seeded from a small fixture
 * map; everything else resolves to a stable derived address so the demo is
 * lively without a network. A prod resolver replaces this with the SuiNS
 * indexer; the interface is the only contract.
 */
export function createOfflineSuiNsResolver(
  fixtures: Record<string, string> = DEFAULT_SUINS_FIXTURES,
): SuiNsResolver {
  const nameToAddr = new Map<string, string>();
  const addrToName = new Map<string, string>();
  for (const [name, addr] of Object.entries(fixtures)) {
    const n = name.toLowerCase();
    const a = normalizeAddress(addr);
    nameToAddr.set(n, a);
    if (!addrToName.has(a)) addrToName.set(a, n);
  }

  return {
    async resolveAddress(name: string): Promise<string | null> {
      return nameToAddr.get(name.toLowerCase()) ?? null;
    },
    async resolveName(address: string): Promise<string | null> {
      return addrToName.get(normalizeAddress(address)) ?? null;
    },
  };
}

export const DEFAULT_SUINS_FIXTURES: Record<string, string> = {
  'mcpx.sui': '0x000000000000000000000000000000000000000000000000000000000000c0de',
  'demo.sui': '0x00000000000000000000000000000000000000000000000000000000000000de',
  'alice.sui': '0x00000000000000000000000000000000000000000000000000000000000a11ce',
};

export interface ZkLoginProof {
  /** OIDC issuer (e.g. https://accounts.google.com). */
  issuer?: string;
  /** Subject identifier from the JWT. */
  sub?: string;
  /** Audience / client id. */
  aud?: string;
  /** The Groth16 proof points (offline verifier only checks shape). */
  proofPoints?: unknown;
  /** Ephemeral pubkey the proof commits to. */
  ephemeralPublicKey?: string;
}

export interface ZkLoginResult {
  valid: boolean;
  issuer: string | null;
  /** Salted hash of `sub` — never echo the raw subject. */
  subHash: string | null;
  reason?: string;
}

export interface ZkLoginVerifier {
  verify(proof: ZkLoginProof): Promise<ZkLoginResult>;
}

const ALLOWED_ISSUERS = new Set([
  'https://accounts.google.com',
  'https://oauth2.googleapis.com',
  'https://www.facebook.com',
  'https://id.twitch.tv/oauth2',
  'https://appleid.apple.com',
  'https://www.salesforce.com',
]);

export function hashSub(issuer: string, sub: string): string {
  return createHash('sha256').update(`${issuer}|${sub}`).digest('hex');
}

/**
 * Offline zkLogin verifier. It does NOT run the Groth16 verification (that
 * needs the verifying key + network); it deterministically validates the
 * proof *envelope* (known issuer, present sub/aud, well-formed proof points)
 * so tests and the demo work with no network. A prod verifier implements the
 * same interface and calls the canonical zkLogin verifier. This is documented
 * as a stub: a `valid:true` here means "well-formed", not "cryptographically
 * verified".
 */
export function createOfflineZkLoginVerifier(): ZkLoginVerifier {
  return {
    async verify(proof: ZkLoginProof): Promise<ZkLoginResult> {
      const issuer = typeof proof.issuer === 'string' ? proof.issuer.trim() : '';
      const sub = typeof proof.sub === 'string' ? proof.sub.trim() : '';
      if (!issuer || !sub) {
        return { valid: false, issuer: null, subHash: null, reason: 'missing issuer or sub' };
      }
      if (!ALLOWED_ISSUERS.has(issuer)) {
        return { valid: false, issuer, subHash: null, reason: 'unrecognised issuer' };
      }
      if (!proof.aud || typeof proof.aud !== 'string') {
        return { valid: false, issuer, subHash: null, reason: 'missing aud' };
      }
      const pp = proof.proofPoints;
      const shapeOk =
        !!pp &&
        typeof pp === 'object' &&
        Array.isArray((pp as { a?: unknown }).a) &&
        Array.isArray((pp as { b?: unknown }).b) &&
        Array.isArray((pp as { c?: unknown }).c);
      if (!shapeOk) {
        return { valid: false, issuer, subHash: null, reason: 'malformed proofPoints' };
      }
      return { valid: true, issuer, subHash: hashSub(issuer, sub) };
    },
  };
}

export interface ReputationStore {
  /** CallReceipt count for a payer address (from the indexer mirror). */
  receiptCount(address: string): Promise<number>;
}

/**
 * Offline reputation store. In production this reads the `call_receipts`
 * indexer mirror table (Postgres) — count of receipts whose payer == address.
 * Reads the indexer mirror, never the chain directly; the mirror is
 * rebuildable from chain and is not the source of truth.
 */
export function createOfflineReputationStore(
  counts: Record<string, number> = {},
): ReputationStore {
  const m = new Map<string, number>();
  for (const [a, n] of Object.entries(counts)) m.set(normalizeAddress(a), n);
  return {
    async receiptCount(address: string): Promise<number> {
      return m.get(normalizeAddress(address)) ?? 0;
    },
  };
}

/** Map a receipt count to a 0..100 reputation score + tier (log-scaled). */
export function scoreFromReceipts(count: number): { score: number; tier: string } {
  if (count <= 0) return { score: 0, tier: 'unknown' };
  const score = Math.min(100, Math.round(Math.log10(count + 1) * 33.3));
  const tier =
    score >= 80 ? 'trusted' : score >= 50 ? 'established' : score >= 20 ? 'active' : 'new';
  return { score, tier };
}
