/**
 * x402 scheme handlers.
 *
 * Each scheme maps a verified PaymentPayload (+ optional settle-time extra)
 * onto `SettleSubmitParams` for the SuiBackend. Adding a scheme = adding a
 * file here + a branch in `pickScheme`; nothing else in the settle path
 * changes. This mirrors the `packages/chain` adapter discipline: one small
 * pure boundary, everything else works against the interface.
 */

import type { PaymentPayloadWire, UptoSettleExtra } from '@mcpxgg/x402';
import type { SettleSubmitParams } from '../sui/types.js';

export interface SchemeBuildInput {
  payload: PaymentPayloadWire;
  /** Tool category for the intent check ('' when no intent). */
  intentCategory: string;
  /** Walrus receipt blob id, '' if none. */
  logBlobId: string;
  /** Whether the underlying server call succeeded. */
  success: boolean;
  /** Present only for the `upto` scheme. */
  uptoExtra?: UptoSettleExtra | undefined;
}

export interface SchemeHandler {
  readonly scheme: 'exact' | 'upto';
  /**
   * Build the chain submit params. Throws `SchemeError` if the settle-time
   * inputs are inconsistent with the signed quote (e.g. upto actual > max).
   */
  build(input: SchemeBuildInput): SettleSubmitParams;
}

export class SchemeError extends Error {
  override readonly name = 'SchemeError';
  constructor(message: string) {
    super(message);
  }
}

function baseParams(input: SchemeBuildInput): SettleSubmitParams {
  const { payload } = input;
  return {
    payerAddress: payload.payerAddress,
    sessionObjectId: payload.sessionObjectId,
    serverObjectId: payload.details.serverObjectId,
    toolName: payload.details.toolName,
    amountAtomic: BigInt(payload.details.amountAtomic),
    ...(payload.intentId !== undefined && {
      intentId: payload.intentId,
      category: input.intentCategory,
    }),
    logBlobId: input.logBlobId,
    success: input.success,
  };
}

/** `exact`: debit exactly the signed amount. Unchanged Sprint 2 behaviour. */
export const exactScheme: SchemeHandler = {
  scheme: 'exact',
  build(input) {
    return baseParams(input);
  },
};

/**
 * `upto`: the signed `amountAtomic` is a *ceiling*. The gateway meters the
 * streamed work and supplies `uptoExtra.actualAtomic`; the contract debits
 * only that (≤ ceiling) and never moves the unused delta.
 */
export const uptoScheme: SchemeHandler = {
  scheme: 'upto',
  build(input) {
    const params = baseParams(input);
    const quotedMax = params.amountAtomic;
    // No extra → treat as a zero-usage finalize (client aborted before any
    // chunk). Still settles (success=false typically) so the receipt exists.
    const actual = input.uptoExtra?.actualAtomic ?? 0n;
    if (actual < 0n) {
      throw new SchemeError('upto actualAtomic must be non-negative');
    }
    if (actual > quotedMax) {
      throw new SchemeError(
        `upto actualAtomic ${actual} exceeds quoted max ${quotedMax}`,
      );
    }
    return { ...params, uptoActualAtomic: actual };
  },
};

export function pickScheme(scheme: 'exact' | 'upto'): SchemeHandler {
  return scheme === 'upto' ? uptoScheme : exactScheme;
}
