import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { asAddress, asBigint, asBoolean, asNumber, asString, asUtf8 } from './parse.js';

describe('asBigint', () => {
  it('parses string, number, bigint', () => {
    assert.equal(asBigint('123', 'f'), 123n);
    assert.equal(asBigint(123, 'f'), 123n);
    assert.equal(asBigint(123n, 'f'), 123n);
  });

  it('throws on malformed input', () => {
    assert.throws(() => asBigint('not', 'f'), /bigint/);
    assert.throws(() => asBigint(null, 'f'), /bigint/);
    assert.throws(() => asBigint({}, 'f'), /bigint/);
  });
});

describe('asNumber', () => {
  it('parses number and numeric string', () => {
    assert.equal(asNumber(7, 'f'), 7);
    assert.equal(asNumber('42', 'f'), 42);
  });
  it('throws on garbage', () => {
    assert.throws(() => asNumber('abc', 'f'), /number/);
    assert.throws(() => asNumber(Number.NaN, 'f'), /number/);
  });
});

describe('asString / asAddress', () => {
  it('roundtrips', () => {
    assert.equal(asString('a', 'f'), 'a');
    assert.equal(asAddress('0xabc', 'f'), '0xabc');
  });
  it('rejects non-string', () => {
    assert.throws(() => asString(1, 'f'), /string/);
    assert.throws(() => asAddress('abc', 'f'), /0x-prefixed/);
  });
});

describe('asBoolean', () => {
  it('roundtrips booleans', () => {
    assert.equal(asBoolean(true, 'f'), true);
    assert.equal(asBoolean(false, 'f'), false);
  });
  it('rejects truthy strings', () => {
    assert.throws(() => asBoolean('true', 'f'), /boolean/);
  });
});

describe('asUtf8', () => {
  it('accepts a plain string', () => {
    assert.equal(asUtf8('hello', 'f'), 'hello');
  });
  it('decodes a byte array', () => {
    assert.equal(asUtf8([0x68, 0x69], 'f'), 'hi');
  });
  it('rejects mixed arrays', () => {
    assert.throws(() => asUtf8([1, 'x'], 'f'), /vector<u8>/);
  });
});
