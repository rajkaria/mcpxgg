/**
 * Thin HTTP client for any x402 facilitator. Used by the gateway (Sprint 3)
 * to talk to `apps/facilitator` and to mock facilitators in tests.
 *
 * The client knows nothing about Sui — it speaks the on-the-wire shape only.
 * Conversion to/from bigint happens here so callers work with native types.
 */

import type {
  PaymentDetails,
  PaymentPayload,
  SettleResult,
  SupportedResult,
  VerifyResult,
} from './types.js';
import {
  detailsToWire,
  parsePaymentDetailsWire,
  payloadFromWire,
  payloadToWire,
  settleResultFromWire,
} from './wire.js';

export interface FacilitatorClientOptions {
  baseUrl: string;
  /** Wraps `fetch`. Defaults to global fetch. Test-injectable. */
  fetchImpl?: typeof fetch;
  /** Default 10s. */
  timeoutMs?: number;
}

export class FacilitatorClient {
  readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: FacilitatorClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
  }

  async supported(): Promise<SupportedResult> {
    const res = await this.req('GET', '/supported');
    return res as SupportedResult;
  }

  async verify(payload: PaymentPayload, details: PaymentDetails): Promise<VerifyResult> {
    const body = {
      payload: payloadToWire(payload),
      details: detailsToWire(details),
    };
    const res = await this.req('POST', '/verify', body);
    return res as VerifyResult;
  }

  async settle(payload: PaymentPayload, details: PaymentDetails): Promise<SettleResult> {
    const body = {
      payload: payloadToWire(payload),
      details: detailsToWire(details),
    };
    const res = (await this.req('POST', '/settle', body)) as unknown as Parameters<typeof settleResultFromWire>[0];
    return settleResultFromWire(res);
  }

  private async req(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const txt = await res.text();
      if (!res.ok) {
        let parsedErr: unknown = txt;
        try {
          parsedErr = JSON.parse(txt);
        } catch {
          /* keep raw */
        }
        throw new FacilitatorHttpError(res.status, parsedErr);
      }
      return txt === '' ? {} : JSON.parse(txt);
    } finally {
      clearTimeout(t);
    }
  }
}

export class FacilitatorHttpError extends Error {
  override readonly name = 'FacilitatorHttpError';
  constructor(public readonly status: number, public readonly body: unknown) {
    super(`facilitator http ${status}`);
  }
}

// Re-export so callers can adopt the parser without two imports.
export { parsePaymentDetailsWire, payloadFromWire };
