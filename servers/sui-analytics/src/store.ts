/**
 * AnalyticsStore — the data seam for sui-analytics (S5-T05).
 *
 * In production this is a Postgres + ClickHouse adapter over indexed Sui state
 * (the indexer in apps/indexer mirrors chain events; ClickHouse holds the
 * wide transfer/event fact tables for OLAP). In CI and the offline demo we
 * have no DB and no keys, so the default is a deterministic in-memory store
 * seeded from fixtures.
 *
 * `runSql` here is NOT a SQL engine. It is a *safe canned-query router*: it
 * recognises the small set of SELECT shapes the heuristic NL->SQL emits and
 * answers them from fixtures. Anything it does not recognise is rejected
 * (after already passing the allowlist guard upstream). There is no eval and
 * no real parser — production swaps in a real Postgres/ClickHouse adapter
 * whose `runSql` simply forwards the (guard-validated) SQL to the engine.
 */

export interface SqlResult {
  columns: string[];
  rows: unknown[][];
}

export interface AnalyticsStore {
  /** Execute a guard-validated SELECT. In-memory impl routes canned shapes. */
  runSql(sql: string, params?: unknown[]): Promise<SqlResult>;
  /** Tx/transfer history for an address, newest first. */
  addressHistory(address: string, limit: number): Promise<SqlResult>;
  /** Version/owner history for an object, newest version first. */
  objectHistory(objectId: string, limit: number): Promise<SqlResult>;
  /** Transfers >= minUsd within the trailing windowHours, newest first. */
  whaleTransfers(minUsd: number, windowHours: number): Promise<SqlResult>;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export interface TransferRow {
  digest: string;
  sender: string;
  recipient: string;
  amountUsd: number;
  coinType: string;
  /** ms since epoch. */
  ts: number;
}

export interface ObjectVersionRow {
  objectId: string;
  version: number;
  owner: string;
  changeType: string;
  ts: number;
}

export interface SeedData {
  transfers: TransferRow[];
  objects: ObjectVersionRow[];
  /** "Now" the store reasons relative to, so windows are deterministic. */
  now: number;
}

const A1 = '0x000000000000000000000000000000000000000000000000000000000000a001';
const A2 = '0x000000000000000000000000000000000000000000000000000000000000a002';
const A3 = '0x000000000000000000000000000000000000000000000000000000000000a003';
const WHALE = '0x00000000000000000000000000000000000000000000000000000000deadbeef';
const OBJ1 = '0x00000000000000000000000000000000000000000000000000000000000b0001';
const OBJ2 = '0x00000000000000000000000000000000000000000000000000000000000b0002';

const FIXED_NOW = Date.UTC(2026, 4, 17, 12, 0, 0); // 2026-05-17T12:00:00Z
const H = 3_600_000;

/** Deterministic fixtures: a handful of addresses, objects, transfers. */
export function defaultSeed(): SeedData {
  return {
    now: FIXED_NOW,
    transfers: [
      // recent whale-scale transfers (inside a 24h window)
      { digest: 'tx_w1', sender: WHALE, recipient: A1, amountUsd: 250_000, coinType: 'USDsui', ts: FIXED_NOW - 2 * H },
      { digest: 'tx_w2', sender: A2, recipient: WHALE, amountUsd: 1_200_000, coinType: 'USDsui', ts: FIXED_NOW - 6 * H },
      { digest: 'tx_w3', sender: A1, recipient: A3, amountUsd: 100_000, coinType: 'USDsui', ts: FIXED_NOW - 20 * H },
      // older whale transfer (outside 24h, inside 7d)
      { digest: 'tx_w4', sender: WHALE, recipient: A2, amountUsd: 500_000, coinType: 'USDsui', ts: FIXED_NOW - 72 * H },
      // small fry
      { digest: 'tx_s1', sender: A1, recipient: A2, amountUsd: 12.5, coinType: 'USDsui', ts: FIXED_NOW - 1 * H },
      { digest: 'tx_s2', sender: A3, recipient: A1, amountUsd: 4_200, coinType: 'SUI', ts: FIXED_NOW - 5 * H },
      { digest: 'tx_s3', sender: A2, recipient: A3, amountUsd: 0.42, coinType: 'USDsui', ts: FIXED_NOW - 30 * H },
    ],
    objects: [
      { objectId: OBJ1, version: 1, owner: A1, changeType: 'created', ts: FIXED_NOW - 100 * H },
      { objectId: OBJ1, version: 2, owner: A2, changeType: 'transferred', ts: FIXED_NOW - 40 * H },
      { objectId: OBJ1, version: 3, owner: A3, changeType: 'transferred', ts: FIXED_NOW - 3 * H },
      { objectId: OBJ2, version: 1, owner: A2, changeType: 'created', ts: FIXED_NOW - 10 * H },
      { objectId: OBJ2, version: 2, owner: A2, changeType: 'mutated', ts: FIXED_NOW - 2 * H },
    ],
  };
}

// ---------------------------------------------------------------------------
// In-memory implementation
// ---------------------------------------------------------------------------

const TRANSFER_COLS = ['digest', 'sender', 'recipient', 'amount_usd', 'coin_type', 'ts'];
const OBJECT_COLS = ['object_id', 'version', 'owner', 'change_type', 'ts'];

function transferRows(rows: TransferRow[]): unknown[][] {
  return rows.map((r) => [r.digest, r.sender, r.recipient, r.amountUsd, r.coinType, new Date(r.ts).toISOString()]);
}
function objectRows(rows: ObjectVersionRow[]): unknown[][] {
  return rows.map((r) => [r.objectId, r.version, r.owner, r.changeType, new Date(r.ts).toISOString()]);
}

/**
 * Canned-query router. Recognised shapes (the heuristic NL->SQL only emits
 * these). Matching is structural keyword sniffing on the *already
 * guard-validated* SQL — not a parser, not eval. Unrecognised shapes throw,
 * so an attacker who somehow slips a novel-but-"safe" SELECT past the guard
 * still gets nothing back.
 */
export function createInMemoryAnalyticsStore(seed: SeedData = defaultSeed()): AnalyticsStore {
  const { transfers, objects, now } = seed;

  function whales(minUsd: number, windowHours: number): SqlResult {
    const cutoff = now - windowHours * H;
    const hits = transfers
      .filter((t) => t.amountUsd >= minUsd && t.ts >= cutoff)
      .sort((a, b) => b.ts - a.ts);
    return { columns: TRANSFER_COLS, rows: transferRows(hits) };
  }

  function addrHistory(address: string, limit: number): SqlResult {
    const addr = address.toLowerCase();
    const hits = transfers
      .filter((t) => t.sender.toLowerCase() === addr || t.recipient.toLowerCase() === addr)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, limit);
    return { columns: TRANSFER_COLS, rows: transferRows(hits) };
  }

  function objHistory(objectId: string, limit: number): SqlResult {
    const id = objectId.toLowerCase();
    const hits = objects
      .filter((o) => o.objectId.toLowerCase() === id)
      .sort((a, b) => b.version - a.version)
      .slice(0, limit);
    return { columns: OBJECT_COLS, rows: objectRows(hits) };
  }

  function topTransfers(limit: number): SqlResult {
    const hits = [...transfers].sort((a, b) => b.amountUsd - a.amountUsd).slice(0, limit);
    return { columns: TRANSFER_COLS, rows: transferRows(hits) };
  }

  function recentTransfers(limit: number): SqlResult {
    const hits = [...transfers].sort((a, b) => b.ts - a.ts).slice(0, limit);
    return { columns: TRANSFER_COLS, rows: transferRows(hits) };
  }

  function transferCount(): SqlResult {
    return { columns: ['transfer_count'], rows: [[transfers.length]] };
  }

  function totalVolume(): SqlResult {
    const total = transfers.reduce((s, t) => s + t.amountUsd, 0);
    return { columns: ['total_volume_usd'], rows: [[total]] };
  }

  return {
    async runSql(sql: string): Promise<SqlResult> {
      const s = sql.toLowerCase();
      const limitMatch = s.match(/\blimit\s+(\d+)/);
      const limit = limitMatch?.[1] ? Number.parseInt(limitMatch[1], 10) : 100;

      // count(*) shapes
      if (/\bcount\s*\(\s*\*?\s*\)/.test(s) && s.includes('from transfers')) {
        return transferCount();
      }
      if (/\bsum\s*\(\s*amount_usd\s*\)/.test(s) && s.includes('from transfers')) {
        return totalVolume();
      }
      // whale: filter on amount_usd >= N and a recency window
      const minMatch = s.match(/amount_usd\s*>=?\s*(\d+(?:\.\d+)?)/);
      if (s.includes('from transfers') && minMatch?.[1] && s.includes('interval')) {
        const hourMatch = s.match(/interval\s+'?(\d+)\s*hour/);
        const windowHours = hourMatch?.[1] ? Number.parseInt(hourMatch[1], 10) : 24;
        return whales(Number.parseFloat(minMatch[1]), windowHours);
      }
      // address history: WHERE sender = '...' OR recipient = '...'
      const addrMatch = s.match(/(?:sender|recipient)\s*=\s*'([0-9a-fx]+)'/);
      if (s.includes('from transfers') && addrMatch?.[1] && /order\s+by\s+ts\s+desc/.test(s)) {
        return addrHistory(addrMatch[1], limit);
      }
      // object history: WHERE object_id = '...'
      const objMatch = s.match(/object_id\s*=\s*'([0-9a-fx]+)'/);
      if (s.includes('from object_versions') && objMatch?.[1]) {
        return objHistory(objMatch[1], limit);
      }
      // top transfers by amount
      if (s.includes('from transfers') && /order\s+by\s+amount_usd\s+desc/.test(s)) {
        return topTransfers(limit);
      }
      // recent transfers
      if (s.includes('from transfers') && /order\s+by\s+ts\s+desc/.test(s)) {
        return recentTransfers(limit);
      }
      throw new Error(
        'query not recognised by the in-memory analytics store; ' +
          'production swaps in a Postgres/ClickHouse adapter that executes guard-validated SQL directly',
      );
    },

    async addressHistory(address: string, limit: number): Promise<SqlResult> {
      return addrHistory(address, limit);
    },
    async objectHistory(objectId: string, limit: number): Promise<SqlResult> {
      return objHistory(objectId, limit);
    },
    async whaleTransfers(minUsd: number, windowHours: number): Promise<SqlResult> {
      return whales(minUsd, windowHours);
    },
  };
}
