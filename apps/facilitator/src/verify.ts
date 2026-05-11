/**
 * Verification policy. Reads chain state via SuiBackend, applies every check
 * in spec §6.2, returns the first failure or { isValid: true }.
 *
 * Order matters: check shape/cryptography first, then chain state (so we
 * never spend an RPC call validating a malformed payload).
 */

import type {
  PaymentDetailsWire,
  PaymentPayloadWire,
  VerifyInvalidReason,
  VerifyResult,
} from '@mcpxgg/x402';
import { parsePaymentDetailsWire, parsePaymentPayloadWire } from '@mcpxgg/x402';
import type { SuiBackend } from './sui/backend.js';
import type { FacilitatorEnv } from './env.js';

export interface VerifyInput {
  payload: unknown;
  details: unknown;
}

export async function verifyPayment(
  input: VerifyInput,
  backend: SuiBackend,
  env: FacilitatorEnv,
): Promise<VerifyResult> {
  let payload: PaymentPayloadWire;
  let echoed: PaymentDetailsWire;
  try {
    payload = parsePaymentPayloadWire(input.payload);
    echoed = parsePaymentDetailsWire(input.details);
  } catch (e) {
    return fail('malformed_payload', (e as Error).message);
  }

  // Network must match the facilitator's network exactly.
  if (payload.details.network !== env.network) {
    return fail('unsupported_network', `expected ${env.network}, got ${payload.details.network}`);
  }
  // Scheme must be a supported one.
  if (payload.details.scheme !== 'exact' && payload.details.scheme !== 'upto') {
    return fail('unsupported_scheme', `scheme ${payload.details.scheme}`);
  }
  // Echoed details must match payload details (no tampering between sign + settle).
  if (!sameDetails(payload.details, echoed)) {
    return fail('malformed_payload', 'echoed details do not match signed details');
  }
  // Token type must match what this facilitator supports.
  if (payload.details.tokenType !== env.usdsuiTypeTag) {
    return fail('unsupported_scheme', `tokenType ${payload.details.tokenType}`);
  }
  // Quote freshness.
  if (payload.details.validUntilMs < backend.nowMs()) {
    return fail('expired_quote', `validUntilMs ${payload.details.validUntilMs}`);
  }

  // Platform pause.
  const cfg = await backend.getPlatformConfig();
  if (cfg.paused) {
    return fail('platform_paused', 'platform paused via admin');
  }

  // Signature.
  const canonical = canonicalMessage(payload.details);
  const sigOk = await backend.verifyEd25519(payload.signature, canonical, payload.payerAddress);
  if (!sigOk) {
    return fail('invalid_signature', 'signature did not verify against payer address');
  }

  // Session.
  const session = await backend.getSession(payload.sessionObjectId);
  if (!session) {
    return fail('session_not_found', payload.sessionObjectId);
  }
  if (!session.active) {
    return fail('session_inactive', 'session is closed');
  }
  if (session.ownerAddress.toLowerCase() !== payload.payerAddress.toLowerCase()) {
    return fail('session_inactive', 'payer is not the session owner');
  }
  if (session.expiresAtMs !== null && session.expiresAtMs < backend.nowMs()) {
    return fail('session_inactive', 'session expired');
  }

  const amount = BigInt(payload.details.amountAtomic);

  // Balance.
  if (session.balanceAtomic < amount) {
    return fail(
      'insufficient_balance',
      `need ${amount}, have ${session.balanceAtomic}`,
    );
  }

  // Per-call cap (0 means "no cap").
  if (session.perCallCapAtomic > 0n && amount > session.perCallCapAtomic) {
    return fail(
      'per_call_cap_exceeded',
      `amount ${amount} > per_call_cap ${session.perCallCapAtomic}`,
    );
  }

  // Per-day cap.
  if (session.perDayCapAtomic > 0n) {
    const today = backend.todayEpochDay();
    const prior = today === session.todayEpochDay ? session.todaySpentAtomic : 0n;
    if (prior + amount > session.perDayCapAtomic) {
      return fail(
        'per_day_cap_exceeded',
        `today_spent ${prior} + amount ${amount} > per_day_cap ${session.perDayCapAtomic}`,
      );
    }
  }

  // Scoped servers.
  if (session.scopedServerObjectIds.length > 0) {
    if (!session.scopedServerObjectIds.includes(payload.details.serverObjectId)) {
      return fail(
        'server_not_authorized',
        `server ${payload.details.serverObjectId} not in scoped set`,
      );
    }
  }

  return { isValid: true };
}

function fail(invalidReason: VerifyInvalidReason, message: string): VerifyResult {
  return { isValid: false, invalidReason, message };
}

function sameDetails(a: PaymentDetailsWire, b: PaymentDetailsWire): boolean {
  return (
    a.scheme === b.scheme &&
    a.network === b.network &&
    a.serverObjectId === b.serverObjectId &&
    a.toolName === b.toolName &&
    a.amountAtomic === b.amountAtomic &&
    a.tokenType === b.tokenType &&
    a.validUntilMs === b.validUntilMs
  );
}

/**
 * Canonical message a buyer signs. Stable across whitespace, key order, and
 * locale because we serialise field-by-field in a fixed order.
 */
export function canonicalMessage(d: PaymentDetailsWire): string {
  return [
    'mcpx-x402:v1',
    d.scheme,
    d.network,
    d.serverObjectId,
    d.toolName,
    d.amountAtomic,
    d.tokenType,
    d.validUntilMs.toString(),
  ].join('|');
}
