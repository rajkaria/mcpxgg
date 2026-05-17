/**
 * Settlement via the x402 facilitator (S3-T04). The gateway never signs a
 * settle PTB itself (CLAUDE.md: "never bypass the facilitator"); it builds
 * the x402 PaymentDetails/Payload and calls `/settle`.
 *
 * The session is custodial: the gateway holds a delegated session signer for
 * the user's Privy-derived address. Real delegated signing lands with Privy
 * embedded wallets in Sprint 4 (S4-T01); until then the signer is injected
 * (tests use the in-memory facilitator's `valid:<addr>` convention).
 */

import type { PaymentDetails, PaymentPayload, SettleResult } from '@mcpxgg/x402';
import { FacilitatorClient } from '@mcpxgg/x402';
import type { GatewayEnv } from './env.js';
import type { AuthContext, ResolvedServer, ResolvedTool } from './store/store.js';

export interface SessionSigner {
  /** Sign the canonical PaymentDetails message on behalf of ownerAddress. */
  sign(message: string, ownerAddress: string): Promise<string> | string;
}

/** Test/local signer matching the in-memory facilitator's accept rule. */
export const devSessionSigner: SessionSigner = {
  sign: (_m, owner) => `valid:${owner}`,
};

const QUOTE_TTL_MS = 60_000;

export interface SettleArgs {
  auth: AuthContext;
  server: ResolvedServer;
  tool: ResolvedTool;
  chargeAtomic: bigint;
  success: boolean;
  receiptBlobId?: string;
  nowMs: number;
}

export interface SettleOutcome {
  settled: boolean;
  result?: SettleResult;
  error?: string;
}

export function buildPayment(
  env: GatewayEnv,
  a: SettleArgs,
): { details: PaymentDetails; canonical: string } {
  const details: PaymentDetails = {
    scheme: 'exact',
    network: env.network,
    serverObjectId: a.server.serverObjectId,
    toolName: a.tool.toolName,
    amountAtomic: a.chargeAtomic,
    tokenType: env.usdsuiTypeTag,
    validUntilMs: a.nowMs + QUOTE_TTL_MS,
    metadata: { gateway: true, userId: a.auth.userId },
  };
  // Canonical message the signer commits to. The facilitator recomputes the
  // same shape in /verify; field order is fixed here.
  const canonical = JSON.stringify({
    scheme: details.scheme,
    network: details.network,
    serverObjectId: details.serverObjectId,
    toolName: details.toolName,
    amountAtomic: details.amountAtomic.toString(),
    tokenType: details.tokenType,
    validUntilMs: details.validUntilMs,
  });
  return { details, canonical };
}

export async function settle(
  env: GatewayEnv,
  client: FacilitatorClient,
  signer: SessionSigner,
  a: SettleArgs,
): Promise<SettleOutcome> {
  const { details, canonical } = buildPayment(env, a);
  const signature = await signer.sign(canonical, a.auth.ownerAddress);
  const payload: PaymentPayload = {
    signature,
    payerAddress: a.auth.ownerAddress,
    sessionObjectId: a.auth.sessionObjectId,
    details,
  };

  const attempt = async (): Promise<SettleResult> =>
    client.settle(payload, details);

  try {
    const r = await attempt();
    if (r.success) return { settled: true, result: r };
    // Non-retryable: verify_failed / platform_paused. Retry once on transient.
    if (r.errorCode === 'rate_limited' || r.errorCode === 'internal_error') {
      const r2 = await attempt();
      return r2.success
        ? { settled: true, result: r2 }
        : { settled: false, ...(r2.errorMessage ? { error: r2.errorMessage } : {}), result: r2 };
    }
    return { settled: false, result: r, ...(r.errorMessage ? { error: r.errorMessage } : {}) };
  } catch (e) {
    // Network error talking to facilitator — one best-effort retry.
    try {
      const r2 = await attempt();
      return r2.success
        ? { settled: true, result: r2 }
        : { settled: false, result: r2 };
    } catch (e2) {
      return { settled: false, error: e2 instanceof Error ? e2.message : String(e) };
    }
  }
}
