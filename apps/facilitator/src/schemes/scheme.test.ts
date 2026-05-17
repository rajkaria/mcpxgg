import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { PaymentPayloadWire } from '@mcpxgg/x402';
import {
  exactScheme,
  pickScheme,
  SchemeError,
  uptoScheme,
} from './scheme.js';

const TOKEN = '0xtest::usdsui::USDSUI';

function wire(
  scheme: 'exact' | 'upto',
  amountAtomic: string,
  intentId?: string,
): PaymentPayloadWire {
  return {
    signature: 'sig',
    payerAddress: '0xpayer',
    sessionObjectId: '0xsess',
    ...(intentId !== undefined && { intentId }),
    details: {
      scheme,
      network: 'sui-testnet',
      serverObjectId: '0xsrv',
      toolName: 'query',
      amountAtomic,
      tokenType: TOKEN,
      validUntilMs: 9_999_999_999_999,
    },
  };
}

describe('pickScheme', () => {
  it('routes exact and upto', () => {
    assert.equal(pickScheme('exact'), exactScheme);
    assert.equal(pickScheme('upto'), uptoScheme);
  });
});

describe('exact scheme', () => {
  it('debits exactly the signed amount, no upto field', () => {
    const p = exactScheme.build({
      payload: wire('exact', '1000000'),
      intentCategory: '',
      logBlobId: '',
      success: true,
    });
    assert.equal(p.amountAtomic, 1_000_000n);
    assert.equal(p.uptoActualAtomic, undefined);
    assert.equal(p.intentId, undefined);
  });

  it('threads intent id + category when present', () => {
    const p = exactScheme.build({
      payload: wire('exact', '500000', '0xintent'),
      intentCategory: 'search',
      logBlobId: 'blob1',
      success: true,
    });
    assert.equal(p.intentId, '0xintent');
    assert.equal(p.category, 'search');
  });
});

describe('upto scheme', () => {
  it('debits the metered actual, keeps signed amount as quoted max', () => {
    const p = uptoScheme.build({
      payload: wire('upto', '1000000'),
      intentCategory: '',
      logBlobId: '',
      success: true,
      uptoExtra: { actualAtomic: 300_000n },
    });
    assert.equal(p.amountAtomic, 1_000_000n); // quoted ceiling
    assert.equal(p.uptoActualAtomic, 300_000n); // metered debit
  });

  it('defaults to zero usage when no extra (client aborted pre-chunk)', () => {
    const p = uptoScheme.build({
      payload: wire('upto', '1000000'),
      intentCategory: '',
      logBlobId: '',
      success: false,
    });
    assert.equal(p.uptoActualAtomic, 0n);
  });

  it('threads intent on the upto+intent path', () => {
    const p = uptoScheme.build({
      payload: wire('upto', '900000', '0xintent'),
      intentCategory: 'stream',
      logBlobId: '',
      success: true,
      uptoExtra: { actualAtomic: 450_000n },
    });
    assert.equal(p.intentId, '0xintent');
    assert.equal(p.category, 'stream');
    assert.equal(p.uptoActualAtomic, 450_000n);
  });

  it('rejects actual > quoted max', () => {
    assert.throws(
      () =>
        uptoScheme.build({
          payload: wire('upto', '1000000'),
          intentCategory: '',
          logBlobId: '',
          success: true,
          uptoExtra: { actualAtomic: 1_000_001n },
        }),
      (e: unknown) => e instanceof SchemeError && /exceeds quoted max/.test((e as Error).message),
    );
  });

  it('allows actual == quoted max (full usage)', () => {
    const p = uptoScheme.build({
      payload: wire('upto', '1000000'),
      intentCategory: '',
      logBlobId: '',
      success: true,
      uptoExtra: { actualAtomic: 1_000_000n },
    });
    assert.equal(p.uptoActualAtomic, 1_000_000n);
  });
});
