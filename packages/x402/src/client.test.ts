import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { FacilitatorClient, FacilitatorHttpError } from './client.js';
import type { PaymentDetails, PaymentPayload } from './types.js';

function mockFetch(handler: (input: string, init: RequestInit) => { status: number; body: unknown }): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const { status, body } = handler(url, init ?? {});
    const json = body === undefined ? '' : JSON.stringify(body);
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => json,
    } as Response;
  }) as typeof fetch;
}

const DETAILS: PaymentDetails = {
  scheme: 'exact',
  network: 'sui-testnet',
  serverObjectId: '0xs',
  toolName: 'q',
  amountAtomic: 100n,
  tokenType: '0x2::usdsui::USDSUI',
  validUntilMs: 9_999_999_999_999,
};

const PAYLOAD: PaymentPayload = {
  signature: 'sig',
  payerAddress: '0xa',
  sessionObjectId: '0xs',
  details: DETAILS,
};

describe('FacilitatorClient', () => {
  it('GET /supported returns parsed body', async () => {
    let seen = '';
    const c = new FacilitatorClient({
      baseUrl: 'http://facil.test',
      fetchImpl: mockFetch((url) => {
        seen = url;
        return {
          status: 200,
          body: {
            schemes: ['exact'],
            networks: ['sui-testnet'],
            tokenType: '0x..::usdsui::USDSUI',
            facilitatorVersion: '0.1.0',
            x402Version: '0.1.0',
          },
        };
      }),
    });
    const r = await c.supported();
    assert.equal(seen, 'http://facil.test/supported');
    assert.deepEqual(r.schemes, ['exact']);
  });

  it('strips trailing slashes from baseUrl', async () => {
    let seen = '';
    const c = new FacilitatorClient({
      baseUrl: 'http://facil.test/',
      fetchImpl: mockFetch((url) => {
        seen = url;
        return { status: 200, body: { schemes: [], networks: [], tokenType: '', facilitatorVersion: '0.0.0', x402Version: '0.1.0' } };
      }),
    });
    await c.supported();
    assert.equal(seen, 'http://facil.test/supported');
  });

  it('POST /verify sends wire-encoded body', async () => {
    let capturedBody: unknown = null;
    const c = new FacilitatorClient({
      baseUrl: 'http://facil.test',
      fetchImpl: mockFetch((_url, init) => {
        capturedBody = JSON.parse(init.body as string);
        return { status: 200, body: { isValid: true } };
      }),
    });
    const r = await c.verify(PAYLOAD, DETAILS);
    assert.equal(r.isValid, true);
    const body = capturedBody as { payload: { details: { amountAtomic: string } }; details: { amountAtomic: string } };
    assert.equal(body.payload.details.amountAtomic, '100');
    assert.equal(body.details.amountAtomic, '100');
  });

  it('POST /settle decodes wire body to bigint', async () => {
    const c = new FacilitatorClient({
      baseUrl: 'http://facil.test',
      fetchImpl: mockFetch(() => ({
        status: 200,
        body: { success: true, txDigest: '0xt', settledAmountAtomic: '100' },
      })),
    });
    const r = await c.settle(PAYLOAD, DETAILS);
    assert.equal(r.success, true);
    assert.equal(r.settledAmountAtomic, 100n);
  });

  it('throws FacilitatorHttpError on 4xx', async () => {
    const c = new FacilitatorClient({
      baseUrl: 'http://facil.test',
      fetchImpl: mockFetch(() => ({ status: 400, body: { errorCode: 'verify_failed' } })),
    });
    await assert.rejects(c.settle(PAYLOAD, DETAILS), (e: unknown) => {
      return e instanceof FacilitatorHttpError && e.status === 400;
    });
  });

  it('aborts on timeout', async () => {
    const c = new FacilitatorClient({
      baseUrl: 'http://facil.test',
      timeoutMs: 1,
      fetchImpl: async (_input, init) => {
        return new Promise<Response>((_resolve, reject) => {
          const sig = init?.signal;
          if (sig) {
            sig.addEventListener('abort', () => reject(new Error('aborted')));
          }
        });
      },
    });
    await assert.rejects(c.supported(), /aborted/);
  });
});
