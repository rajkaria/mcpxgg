import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  atomicStringFromBigint,
  bigintFromAtomicString,
  detailsFromWire,
  detailsToWire,
  parsePaymentDetailsWire,
  parsePaymentPayloadWire,
  payloadFromWire,
  payloadToWire,
  settleResultFromWire,
  settleResultToWire,
} from './wire.js';
import type { PaymentDetails, PaymentPayload, SettleResult } from './types.js';

const VALID_DETAILS: PaymentDetails = {
  scheme: 'exact',
  network: 'sui-testnet',
  serverObjectId: '0xabc',
  toolName: 'query',
  amountAtomic: 1_500_000n,
  tokenType: '0xdef::usdsui::USDSUI',
  validUntilMs: 9_999_999_999_999,
};

const VALID_PAYLOAD: PaymentPayload = {
  signature: 'sig-base64',
  payerAddress: '0xaaa',
  sessionObjectId: '0xbbb',
  details: VALID_DETAILS,
};

describe('atomic <-> string roundtrip', () => {
  it('roundtrips zero', () => {
    assert.equal(atomicStringFromBigint(0n), '0');
    assert.equal(bigintFromAtomicString('0'), 0n);
  });

  it('roundtrips a 6-decimal value', () => {
    assert.equal(atomicStringFromBigint(1_234_567n), '1234567');
    assert.equal(bigintFromAtomicString('1234567'), 1_234_567n);
  });

  it('roundtrips a value larger than 2^53', () => {
    const huge = 9_007_199_254_740_993n * 1_000n;
    const s = atomicStringFromBigint(huge);
    assert.equal(bigintFromAtomicString(s), huge);
  });

  it('rejects negative bigint', () => {
    assert.throws(() => atomicStringFromBigint(-1n), /non-negative/);
  });

  it('rejects scientific notation', () => {
    assert.throws(() => bigintFromAtomicString('1e6'), /invalid atomic string/);
  });

  it('rejects leading zeros', () => {
    assert.throws(() => bigintFromAtomicString('001'), /invalid atomic string/);
  });

  it('rejects signs and decimals', () => {
    assert.throws(() => bigintFromAtomicString('-1'), /invalid atomic string/);
    assert.throws(() => bigintFromAtomicString('+1'), /invalid atomic string/);
    assert.throws(() => bigintFromAtomicString('1.5'), /invalid atomic string/);
  });
});

describe('details ⇄ wire', () => {
  it('roundtrips PaymentDetails', () => {
    const wire = detailsToWire(VALID_DETAILS);
    assert.equal(wire.amountAtomic, '1500000');
    const back = detailsFromWire(wire);
    assert.deepEqual(back, VALID_DETAILS);
  });

  it('roundtrips PaymentPayload', () => {
    const wire = payloadToWire(VALID_PAYLOAD);
    assert.equal(wire.details.amountAtomic, '1500000');
    const back = payloadFromWire(wire);
    assert.deepEqual(back, VALID_PAYLOAD);
  });

  it('roundtrips SettleResult both with and without settledAmount', () => {
    const r1: SettleResult = { success: true, txDigest: '0xtx', receiptObjectId: '0xrr', settledAmountAtomic: 999n };
    const w1 = settleResultToWire(r1);
    assert.equal(w1.settledAmountAtomic, '999');
    assert.deepEqual(settleResultFromWire(w1), r1);

    const r2: SettleResult = { success: false, errorCode: 'verify_failed' };
    const w2 = settleResultToWire(r2);
    assert.equal((w2 as { settledAmountAtomic?: string }).settledAmountAtomic, undefined);
    assert.deepEqual(settleResultFromWire(w2), r2);
  });
});

describe('parsePaymentDetailsWire', () => {
  function base(): Record<string, unknown> {
    return {
      scheme: 'exact',
      network: 'sui-testnet',
      serverObjectId: '0xabc',
      toolName: 'query',
      amountAtomic: '1500000',
      tokenType: '0xdef::usdsui::USDSUI',
      validUntilMs: 9_999_999_999_999,
    };
  }

  it('accepts a valid payload', () => {
    const parsed = parsePaymentDetailsWire(base());
    assert.equal(parsed.amountAtomic, '1500000');
  });

  it('rejects unsupported scheme', () => {
    const x = base();
    x.scheme = 'partial';
    assert.throws(() => parsePaymentDetailsWire(x), /unsupported scheme/);
  });

  it('rejects unsupported network', () => {
    const x = base();
    x.network = 'ethereum-mainnet';
    assert.throws(() => parsePaymentDetailsWire(x), /unsupported network/);
  });

  it('rejects bad serverObjectId', () => {
    const x = base();
    x.serverObjectId = 'no-0x';
    assert.throws(() => parsePaymentDetailsWire(x), /serverObjectId/);
  });

  it('rejects empty toolName', () => {
    const x = base();
    x.toolName = '';
    assert.throws(() => parsePaymentDetailsWire(x), /toolName/);
  });

  it('rejects malformed amount', () => {
    const x = base();
    x.amountAtomic = '-3';
    assert.throws(() => parsePaymentDetailsWire(x), /amountAtomic/);
  });

  it('rejects malformed tokenType', () => {
    const x = base();
    x.tokenType = 'usdsui';
    assert.throws(() => parsePaymentDetailsWire(x), /tokenType/);
  });

  it('rejects non-positive validUntilMs', () => {
    const x = base();
    x.validUntilMs = -1;
    assert.throws(() => parsePaymentDetailsWire(x), /validUntilMs/);
  });
});

describe('parsePaymentPayloadWire', () => {
  function base(): Record<string, unknown> {
    return {
      signature: 'sig',
      payerAddress: '0xaaa',
      sessionObjectId: '0xbbb',
      details: {
        scheme: 'exact',
        network: 'sui-testnet',
        serverObjectId: '0xabc',
        toolName: 'query',
        amountAtomic: '1500000',
        tokenType: '0xdef::usdsui::USDSUI',
        validUntilMs: 9_999_999_999_999,
      },
    };
  }

  it('parses a valid payload', () => {
    const p = parsePaymentPayloadWire(base());
    assert.equal(p.payerAddress, '0xaaa');
    assert.equal(p.details.amountAtomic, '1500000');
    assert.equal(p.intentId, undefined);
  });

  it('rejects missing 0x prefix on payer', () => {
    const x = base();
    x.payerAddress = 'aaa';
    assert.throws(() => parsePaymentPayloadWire(x), /payerAddress/);
  });

  it('accepts optional intentId when 0x-prefixed', () => {
    const x = base();
    x.intentId = '0xintent';
    const p = parsePaymentPayloadWire(x);
    assert.equal(p.intentId, '0xintent');
  });

  it('rejects non-string signature', () => {
    const x = base();
    x.signature = 123;
    assert.throws(() => parsePaymentPayloadWire(x), /signature/);
  });

  it('rejects non-object input', () => {
    assert.throws(() => parsePaymentPayloadWire('string'), /not an object/);
    assert.throws(() => parsePaymentPayloadWire(null), /not an object/);
    assert.throws(() => parsePaymentPayloadWire([]), /not an object/);
  });
});
