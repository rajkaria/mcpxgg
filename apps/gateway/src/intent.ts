/**
 * Spending-intent validation (S6-T06).
 *
 * When a request carries `X-Mcpx-Intent-Id`, the gateway pre-validates the
 * intent against the same policy the on-chain `intent::record_spend` enforces
 * (contracts/sources/intent.move) so we fast-fail before calling a paid server
 * or the facilitator. The chain re-checks all of this atomically inside
 * `settlement::settle_call_with_intent`; this is the cheap mirror.
 *
 * READ ONLY: the intent is read from the indexer mirror via the injected
 * store. The gateway never writes intent state and never signs settlement —
 * on success it hands the intent id + category to the facilitator (ADR-011,
 * CLAUDE.md "never bypass the facilitator").
 */

import { GatewayError } from './errors.js';
import type { ResolvedIntent } from './store/store.js';

export type { ResolvedIntent };

export interface IntentStore {
  /** Read the indexer mirror. null if unknown. */
  resolveIntent(intentObjectId: string): Promise<ResolvedIntent | null>;
}

export interface ValidateIntentInput {
  intentObjectId: string;
  /** Category from `X-Mcpx-Category` (empty string if absent). */
  category: string;
  /** Authenticated caller — the session owner. */
  callerAddress: string;
  serverObjectId: string;
  /** What this call will settle for (0 if free-tier). */
  chargeAtomic: bigint;
  nowMs: number;
}

const DAY_MS = 86_400_000;

/**
 * Resolve + validate. Throws `GatewayError` with an `intent_*` code on any
 * policy failure (no settlement, no server call). Returns the resolved intent
 * on success so the caller can thread the id/category to the facilitator.
 */
export async function validateIntent(
  store: IntentStore,
  input: ValidateIntentInput,
): Promise<ResolvedIntent> {
  const intent = await store.resolveIntent(input.intentObjectId);
  if (!intent) {
    throw new GatewayError(
      `Spending intent ${input.intentObjectId} not found`,
      'intent_not_found',
    );
  }
  if (intent.revoked) {
    throw new GatewayError('Spending intent has been revoked', 'intent_revoked');
  }
  if (intent.expiresAtMs > 0 && input.nowMs >= intent.expiresAtMs) {
    throw new GatewayError('Spending intent has expired', 'intent_expired');
  }
  if (
    intent.agentAddress.toLowerCase() !== input.callerAddress.toLowerCase()
  ) {
    throw new GatewayError(
      'Caller is not the agent named in this spending intent',
      'intent_agent_mismatch',
    );
  }
  if (
    intent.serverObjectIds.length > 0 &&
    !intent.serverObjectIds.includes(input.serverObjectId)
  ) {
    throw new GatewayError(
      'Server is not in the spending intent scope',
      'intent_scope_mismatch',
    );
  }
  if (
    intent.allowedCategories.length > 0 &&
    !intent.allowedCategories.includes(input.category)
  ) {
    throw new GatewayError(
      `Category "${input.category}" is not allowed by this spending intent`,
      'intent_category_not_allowed',
    );
  }

  // Free-tier calls settle 0 — caps are irrelevant (matches the chain: a
  // 0-amount record_spend never trips per-call/daily caps).
  if (input.chargeAtomic === 0n) return intent;

  if (
    intent.perCallCapAtomic > 0n &&
    input.chargeAtomic > intent.perCallCapAtomic
  ) {
    throw new GatewayError(
      `Call costs ${input.chargeAtomic} > intent per-call cap ${intent.perCallCapAtomic}`,
      'intent_per_call_cap_exceeded',
    );
  }
  if (intent.dailyCapAtomic > 0n) {
    const today = Math.floor(input.nowMs / DAY_MS);
    const spentToday =
      intent.todayEpochDay === today ? intent.todaySpentAtomic : 0n;
    if (spentToday + input.chargeAtomic > intent.dailyCapAtomic) {
      throw new GatewayError(
        `Daily spend ${spentToday + input.chargeAtomic} would exceed intent daily cap ${intent.dailyCapAtomic}`,
        'intent_daily_cap_exceeded',
      );
    }
  }

  return intent;
}
