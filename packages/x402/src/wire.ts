/**
 * Wire serialization for x402 payloads.
 *
 * BigInt is not JSON-serializable; we encode atomic amounts as decimal strings
 * and reject anything that doesn't roundtrip cleanly. Decimal-only — no
 * scientific notation, no signs, no leading zeros except for "0" itself.
 *
 * The on-wire shape is named with the `…Wire` suffix; in-process shapes use
 * native `bigint`. Always convert at I/O boundaries (HTTP handlers, queue
 * consumers, Redis pubsub) — never let a `…Wire` shape leak past parse.
 */

import type {
  PaymentDetails,
  PaymentDetailsWire,
  PaymentPayload,
  PaymentPayloadWire,
  SettleResult,
  SettleResultWire,
  UptoSettleExtra,
  UptoSettleExtraWire,
} from './types.js';
import {
  ALL_NETWORKS,
  ALL_SCHEMES,
  type Network,
  type Scheme,
} from './types.js';

const DECIMAL_RE = /^(0|[1-9]\d*)$/;

export function bigintFromAtomicString(s: string): bigint {
  if (typeof s !== 'string' || !DECIMAL_RE.test(s)) {
    throw new TypeError(`invalid atomic string: ${JSON.stringify(s)}`);
  }
  return BigInt(s);
}

export function atomicStringFromBigint(n: bigint): string {
  if (typeof n !== 'bigint') throw new TypeError('atomicStringFromBigint expects bigint');
  if (n < 0n) throw new RangeError('atomic amount must be non-negative');
  return n.toString(10);
}

// ─── PaymentDetails ⇄ PaymentDetailsWire ──────────────────────────────────

export function detailsToWire(d: PaymentDetails): PaymentDetailsWire {
  return { ...d, amountAtomic: atomicStringFromBigint(d.amountAtomic) };
}

export function detailsFromWire(w: PaymentDetailsWire): PaymentDetails {
  return { ...w, amountAtomic: bigintFromAtomicString(w.amountAtomic) };
}

// ─── PaymentPayload ⇄ PaymentPayloadWire ──────────────────────────────────

export function payloadToWire(p: PaymentPayload): PaymentPayloadWire {
  return { ...p, details: detailsToWire(p.details) };
}

export function payloadFromWire(w: PaymentPayloadWire): PaymentPayload {
  return { ...w, details: detailsFromWire(w.details) };
}

// ─── SettleResult ⇄ SettleResultWire ──────────────────────────────────────

export function settleResultToWire(r: SettleResult): SettleResultWire {
  const {
    settledAmountAtomic,
    quotedMaxAtomic,
    unusedAtomic,
    ...rest
  } = r;
  const out: SettleResultWire = { ...rest };
  if (settledAmountAtomic !== undefined) {
    out.settledAmountAtomic = atomicStringFromBigint(settledAmountAtomic);
  }
  if (quotedMaxAtomic !== undefined) {
    out.quotedMaxAtomic = atomicStringFromBigint(quotedMaxAtomic);
  }
  if (unusedAtomic !== undefined) {
    out.unusedAtomic = atomicStringFromBigint(unusedAtomic);
  }
  return out;
}

export function settleResultFromWire(w: SettleResultWire): SettleResult {
  const {
    settledAmountAtomic,
    quotedMaxAtomic,
    unusedAtomic,
    ...rest
  } = w;
  const out: SettleResult = { ...rest };
  if (settledAmountAtomic !== undefined) {
    out.settledAmountAtomic = bigintFromAtomicString(settledAmountAtomic);
  }
  if (quotedMaxAtomic !== undefined) {
    out.quotedMaxAtomic = bigintFromAtomicString(quotedMaxAtomic);
  }
  if (unusedAtomic !== undefined) {
    out.unusedAtomic = bigintFromAtomicString(unusedAtomic);
  }
  return out;
}

// ─── UptoSettleExtra ⇄ UptoSettleExtraWire ────────────────────────────────

export function uptoSettleExtraToWire(e: UptoSettleExtra): UptoSettleExtraWire {
  return { actualAtomic: atomicStringFromBigint(e.actualAtomic) };
}

export function uptoSettleExtraFromWire(w: UptoSettleExtraWire): UptoSettleExtra {
  return { actualAtomic: bigintFromAtomicString(w.actualAtomic) };
}

/**
 * Parse the untrusted `uptoExtra` blob on a /settle request body. Returns
 * undefined when absent (exact-scheme settle). Throws on malformed input —
 * the facilitator HTTP handler maps the throw to a verify_failed response.
 */
export function parseUptoSettleExtra(raw: unknown): UptoSettleExtra | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isObject(raw)) throw new TypeError('uptoExtra is not an object');
  const { actualAtomic } = raw;
  if (typeof actualAtomic !== 'string' || !DECIMAL_RE.test(actualAtomic)) {
    throw new TypeError('uptoExtra.actualAtomic must be a decimal string');
  }
  return { actualAtomic: bigintFromAtomicString(actualAtomic) };
}

// ─── Parse / validate untrusted JSON  ─────────────────────────────────────

/** Throws on malformed input. The facilitator HTTP handler converts the
 *  thrown error into `{ isValid: false, invalidReason: 'malformed_payload' }`. */
export function parsePaymentPayloadWire(json: unknown): PaymentPayloadWire {
  if (!isObject(json)) throw new TypeError('payload is not an object');
  const { signature, payerAddress, sessionObjectId, intentId, details } = json;
  if (typeof signature !== 'string' || signature.length === 0) {
    throw new TypeError('signature must be a non-empty string');
  }
  if (typeof payerAddress !== 'string' || !payerAddress.startsWith('0x')) {
    throw new TypeError('payerAddress must be a 0x-prefixed sui address');
  }
  if (typeof sessionObjectId !== 'string' || !sessionObjectId.startsWith('0x')) {
    throw new TypeError('sessionObjectId must be a 0x-prefixed object id');
  }
  if (intentId !== undefined && (typeof intentId !== 'string' || !intentId.startsWith('0x'))) {
    throw new TypeError('intentId must be a 0x-prefixed object id when present');
  }
  const detailsWire = parsePaymentDetailsWire(details);
  return {
    signature,
    payerAddress,
    sessionObjectId,
    ...(intentId !== undefined && { intentId }),
    details: detailsWire,
  };
}

export function parsePaymentDetailsWire(raw: unknown): PaymentDetailsWire {
  if (!isObject(raw)) throw new TypeError('details is not an object');
  const {
    scheme,
    network,
    serverObjectId,
    toolName,
    amountAtomic,
    tokenType,
    validUntilMs,
    metadata,
  } = raw;
  if (!isScheme(scheme)) throw new TypeError(`unsupported scheme: ${String(scheme)}`);
  if (!isNetwork(network)) throw new TypeError(`unsupported network: ${String(network)}`);
  if (typeof serverObjectId !== 'string' || !serverObjectId.startsWith('0x')) {
    throw new TypeError('serverObjectId must be a 0x-prefixed object id');
  }
  if (typeof toolName !== 'string' || toolName.length === 0) {
    throw new TypeError('toolName must be a non-empty string');
  }
  if (typeof amountAtomic !== 'string' || !DECIMAL_RE.test(amountAtomic)) {
    throw new TypeError('amountAtomic must be a decimal string');
  }
  if (typeof tokenType !== 'string' || !tokenType.includes('::')) {
    throw new TypeError('tokenType must look like 0x..::module::TYPE');
  }
  if (typeof validUntilMs !== 'number' || !Number.isFinite(validUntilMs) || validUntilMs <= 0) {
    throw new TypeError('validUntilMs must be a positive number');
  }
  if (metadata !== undefined && !isObject(metadata)) {
    throw new TypeError('metadata must be an object when present');
  }
  return {
    scheme,
    network,
    serverObjectId,
    toolName,
    amountAtomic,
    tokenType,
    validUntilMs,
    ...(metadata !== undefined && { metadata: metadata as Record<string, unknown> }),
  };
}

function isScheme(v: unknown): v is Scheme {
  return typeof v === 'string' && (ALL_SCHEMES as readonly string[]).includes(v);
}

function isNetwork(v: unknown): v is Network {
  return typeof v === 'string' && (ALL_NETWORKS as readonly string[]).includes(v);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
