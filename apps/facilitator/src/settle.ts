/**
 * Settlement orchestrator.
 *
 * `/settle` is verify + chain submit + record gas. If verify fails the
 * settle path never touches the chain — that's the entire reason the two
 * endpoints exist separately in x402.
 */

import type { SettleErrorCode, SettleResult, UptoSettleExtra } from '@mcpxgg/x402';
import { parsePaymentPayloadWire } from '@mcpxgg/x402';
import type { SuiBackend } from './sui/backend.js';
import { ChainError } from './sui/types.js';
import type { FacilitatorEnv } from './env.js';
import { GasStation, rateLimitedChainError } from './gas-station.js';
import { verifyPayment, type VerifyInput } from './verify.js';
import { pickScheme, SchemeError } from './schemes/scheme.js';

export interface SettleInput extends VerifyInput {
  /** Optional Walrus blob id where the caller archived the request/response. */
  receiptBlobId?: string;
  /** Whether the underlying server call succeeded. Default true. */
  success?: boolean;
  /**
   * `upto`-scheme settle-time supplement: the metered amount to actually
   * debit (≤ the signed ceiling). Ignored for the `exact` scheme.
   */
  uptoExtra?: UptoSettleExtra | undefined;
}

export async function settlePayment(
  input: SettleInput,
  backend: SuiBackend,
  env: FacilitatorEnv,
  gasStation: GasStation,
): Promise<SettleResult> {
  const verifyResult = await verifyPayment(input, backend, env);
  if (!verifyResult.isValid) {
    return {
      success: false,
      errorCode: 'verify_failed',
      errorMessage: `${verifyResult.invalidReason}: ${verifyResult.message ?? ''}`.trim(),
    };
  }

  const check = gasStation.check();
  if (!check.allowed) {
    return {
      success: false,
      errorCode: check.reason === 'rate_limited' ? 'rate_limited' : 'platform_paused',
      errorMessage: check.reason === 'rate_limited'
        ? `retry after ${check.retryAfterMs ?? 0}ms`
        : 'gas station daily budget exhausted',
    };
  }

  const payload = parsePaymentPayloadWire(input.payload);
  const intentCategory =
    payload.intentId !== undefined &&
    typeof payload.details.metadata?.intentCategory === 'string'
      ? (payload.details.metadata.intentCategory as string)
      : '';

  const handler = pickScheme(payload.details.scheme);
  let submitParams;
  try {
    submitParams = handler.build({
      payload,
      intentCategory,
      logBlobId: input.receiptBlobId ?? '',
      success: input.success ?? true,
      uptoExtra: input.uptoExtra,
    });
  } catch (e) {
    if (e instanceof SchemeError) {
      return { success: false, errorCode: 'verify_failed', errorMessage: e.message };
    }
    throw e;
  }

  try {
    const result = await backend.submitSettle(submitParams);
    gasStation.record(0n); // gas cost tracked separately; record the request slot
    return {
      success: true,
      txDigest: result.txDigest,
      receiptObjectId: result.receiptObjectId,
      settledAmountAtomic: result.settledAmountAtomic,
      ...(result.quotedMaxAtomic !== undefined && {
        quotedMaxAtomic: result.quotedMaxAtomic,
      }),
      ...(result.unusedAtomic !== undefined && {
        unusedAtomic: result.unusedAtomic,
      }),
      ...(input.receiptBlobId !== undefined && { receiptBlobId: input.receiptBlobId }),
    };
  } catch (e) {
    if (e instanceof ChainError) {
      const map: Record<ChainError['code'], SettleErrorCode> = {
        gas_budget_exceeded: 'gas_budget_exceeded',
        rpc_unreachable: 'internal_error',
        execution_failed: 'chain_error',
        unknown: 'internal_error',
      };
      return { success: false, errorCode: map[e.code], errorMessage: e.message };
    }
    if (e instanceof Error && e.message.includes('rate limited')) {
      const rl = rateLimitedChainError({ allowed: false, reason: 'rate_limited' });
      return { success: false, errorCode: 'rate_limited', errorMessage: rl.message };
    }
    return {
      success: false,
      errorCode: 'internal_error',
      errorMessage: (e as Error).message,
    };
  }
}
