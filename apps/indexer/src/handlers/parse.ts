/**
 * Sui Move events arrive with stringly-typed numeric fields and byte-vector
 * strings. Helpers here normalize them into the canonical TS shape.
 */

export function asBigint(v: unknown, field: string): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return BigInt(v);
  if (typeof v === 'string' && v.length > 0) {
    try {
      return BigInt(v);
    } catch {
      throw new TypeError(`expected bigint-like for ${field}, got ${v}`);
    }
  }
  throw new TypeError(`expected bigint-like for ${field}, got ${typeof v}`);
}

export function asNumber(v: unknown, field: string): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  throw new TypeError(`expected number for ${field}, got ${typeof v}`);
}

export function asString(v: unknown, field: string): string {
  if (typeof v === 'string') return v;
  throw new TypeError(`expected string for ${field}, got ${typeof v}`);
}

export function asAddress(v: unknown, field: string): string {
  const s = asString(v, field);
  if (!s.startsWith('0x')) throw new TypeError(`expected 0x-prefixed address for ${field}, got ${s}`);
  return s;
}

export function asBoolean(v: unknown, field: string): boolean {
  if (typeof v === 'boolean') return v;
  throw new TypeError(`expected boolean for ${field}, got ${typeof v}`);
}

/**
 * Move emits `vector<u8>` as a byte array. The indexer sees those as a
 * JSON array of small integers, or sometimes already-decoded UTF-8.
 */
export function asUtf8(v: unknown, field: string): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.every((x) => typeof x === 'number')) {
    return new TextDecoder().decode(new Uint8Array(v as number[]));
  }
  throw new TypeError(`expected vector<u8> for ${field}, got ${typeof v}`);
}
