/**
 * @mcpxgg/x402 — x402 spec types and Sui scheme client.
 *
 * Sprint 2 (S2-T02): types, wire codecs, and FacilitatorClient.
 * Sprint 7 (S7-T01): `upto` scheme + streaming refund flow.
 */

export {
  X402_VERSION,
  ALL_SCHEMES,
  ALL_NETWORKS,
  type Scheme,
  type Network,
  type PaymentDetails,
  type PaymentDetailsWire,
  type PaymentPayload,
  type PaymentPayloadWire,
  type VerifyResult,
  type VerifyInvalidReason,
  type SettleResult,
  type SettleResultWire,
  type SettleErrorCode,
  type SupportedResult,
} from './types.js';

export {
  bigintFromAtomicString,
  atomicStringFromBigint,
  detailsToWire,
  detailsFromWire,
  payloadToWire,
  payloadFromWire,
  settleResultToWire,
  settleResultFromWire,
  parsePaymentPayloadWire,
  parsePaymentDetailsWire,
} from './wire.js';

export {
  FacilitatorClient,
  FacilitatorHttpError,
  type FacilitatorClientOptions,
} from './client.js';
