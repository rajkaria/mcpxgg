import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  parseUptoSettleExtra,
  settleResultFromWire,
  settleResultToWire,
  uptoSettleExtraFromWire,
  uptoSettleExtraToWire,
} from './wire.js';
import type { SettleResult, UptoSettleExtra } from './types.js';
import { ALL_SCHEMES } from './types.js';

describe('upto scheme is a registered scheme', () => {
  it('is in ALL_SCHEMES', () => {
    assert.ok((ALL_SCHEMES as readonly string[]).includes('upto'));
  });
});

describe('UptoSettleExtra <-> wire roundtrip', () => {
  it('roundtrips a metered actual amount', () => {
    const e: UptoSettleExtra = { actualAtomic: 1_234_000n };
    const w = uptoSettleExtraToWire(e);
    assert.equal(w.actualAtomic, '1234000');
    assert.deepEqual(uptoSettleExtraFromWire(w), e);
  });

  it('roundtrips zero (client aborted before any chunk)', () => {
    const w = uptoSettleExtraToWire({ actualAtomic: 0n });
    assert.equal(w.actualAtomic, '0');
    assert.equal(uptoSettleExtraFromWire(w).actualAtomic, 0n);
  });
});

describe('parseUptoSettleExtra', () => {
  it('returns undefined when absent (exact-scheme settle)', () => {
    assert.equal(parseUptoSettleExtra(undefined), undefined);
    assert.equal(parseUptoSettleExtra(null), undefined);
  });

  it('parses a valid decimal string', () => {
    const e = parseUptoSettleExtra({ actualAtomic: '500000' });
    assert.deepEqual(e, { actualAtomic: 500_000n });
  });

  it('rejects a non-object', () => {
    assert.throws(() => parseUptoSettleExtra('x'), /not an object/);
    assert.throws(() => parseUptoSettleExtra(5), /not an object/);
  });

  it('rejects a non-decimal actualAtomic', () => {
    assert.throws(
      () => parseUptoSettleExtra({ actualAtomic: '12.5' }),
      /actualAtomic/,
    );
    assert.throws(
      () => parseUptoSettleExtra({ actualAtomic: -1 }),
      /actualAtomic/,
    );
    assert.throws(
      () => parseUptoSettleExtra({ actualAtomic: '0x10' }),
      /actualAtomic/,
    );
  });
});

describe('SettleResult upto fields wire codec', () => {
  it('serialises quotedMax/unused alongside settled', () => {
    const r: SettleResult = {
      success: true,
      txDigest: '0xtx',
      receiptObjectId: '0xrcpt',
      settledAmountAtomic: 300_000n,
      quotedMaxAtomic: 1_000_000n,
      unusedAtomic: 700_000n,
    };
    const w = settleResultToWire(r);
    assert.equal(w.settledAmountAtomic, '300000');
    assert.equal(w.quotedMaxAtomic, '1000000');
    assert.equal(w.unusedAtomic, '700000');
    assert.deepEqual(settleResultFromWire(w), r);
  });

  it('omits upto fields entirely for an exact-scheme result', () => {
    const r: SettleResult = {
      success: true,
      txDigest: '0xtx',
      settledAmountAtomic: 5_000n,
    };
    const w = settleResultToWire(r);
    assert.equal('quotedMaxAtomic' in w, false);
    assert.equal('unusedAtomic' in w, false);
    assert.deepEqual(settleResultFromWire(w), r);
  });

  it('roundtrips a failure result with no amounts', () => {
    const r: SettleResult = {
      success: false,
      errorCode: 'verify_failed',
      errorMessage: 'bad sig',
    };
    assert.deepEqual(settleResultFromWire(settleResultToWire(r)), r);
  });
});
