import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSuiAnalyticsServer } from './server.js';
import { createInMemoryAnalyticsStore } from './store.js';
import { createHeuristicSqlLlm, type SqlLlm } from './llm.js';

function rpc(
  server: ReturnType<typeof createSuiAnalyticsServer>,
  name: string,
  args: Record<string, unknown>,
) {
  return Promise.resolve(
    server.fetch(
      new Request('http://s/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name, arguments: args },
        }),
      }),
    ),
  ).then(
    (r) =>
      r.json() as Promise<{
        result: { content: Array<{ text: string }>; isError: boolean };
      }>,
  );
}

function makeServer(llm?: SqlLlm) {
  return createSuiAnalyticsServer({
    store: createInMemoryAnalyticsStore(),
    llm: llm ?? createHeuristicSqlLlm(),
  });
}

test('manifest exposes all four tools with string bigint prices', () => {
  const m = makeServer().manifest();
  const names = m.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ['address_history', 'object_history', 'query', 'whale_alert']);
  const query = m.tools.find((t) => t.name === 'query');
  assert.equal(query?.priceAtomic, '8000');
  assert.equal(query?.freeTierCallsPerUser, 1);
  assert.equal(m.tools.find((t) => t.name === 'whale_alert')?.priceAtomic, '2000');
  assert.equal(m.tools.find((t) => t.name === 'address_history')?.priceAtomic, '3000');
});

test('query: NL -> guarded SQL -> rows (whale question)', async () => {
  const r = await rpc(makeServer(), 'query', {
    question: 'show me large whale transfers',
  });
  assert.equal(r.result.isError, false);
  const body = JSON.parse(r.result.content[0]!.text) as {
    sql: string;
    rows: Array<Record<string, unknown>>;
    rowCount: number;
    truncated: boolean;
  };
  assert.match(body.sql, /^SELECT .* FROM transfers WHERE amount_usd >= \d+/);
  assert.match(body.sql, /LIMIT \d+$/);
  assert.ok(body.rowCount >= 1, 'returns whale rows from fixtures');
  assert.equal(body.truncated, false);
});

test('query: address question routes to address history shape', async () => {
  const addr = '0x000000000000000000000000000000000000000000000000000000000000a001';
  const r = await rpc(makeServer(), 'query', {
    question: `what is the activity for wallet ${addr}`,
  });
  const body = JSON.parse(r.result.content[0]!.text) as {
    sql: string;
    rows: Array<Record<string, unknown>>;
  };
  assert.match(body.sql, /sender = '0x0+a001'/);
  assert.ok(body.rows.length >= 1);
  assert.ok('digest' in body.rows[0]!);
});

test('query: requires a question', async () => {
  const r = await rpc(makeServer(), 'query', {});
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0]!.text, /question is required/);
});

test('query: malicious LLM SQL is rejected end-to-end by the guard', async () => {
  const evilLlm: SqlLlm = {
    async toSql() {
      return "SELECT * FROM transfers; DROP TABLE transfers LIMIT 1";
    },
  };
  const r = await rpc(makeServer(evilLlm), 'query', {
    question: 'innocent looking question',
  });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0]!.text, /SQL safety guard/);
});

test('query: maxRows is clamped and threaded into the LIMIT', async () => {
  const r = await rpc(makeServer(createHeuristicSqlLlm(5)), 'query', {
    question: 'top transfers',
    maxRows: 5,
  });
  const body = JSON.parse(r.result.content[0]!.text) as { sql: string };
  assert.match(body.sql, /LIMIT 5$/);
});

test('address_history: returns transfers touching the address', async () => {
  const addr = '0x000000000000000000000000000000000000000000000000000000000000a001';
  const r = await rpc(makeServer(), 'address_history', { address: addr, limit: 10 });
  const body = JSON.parse(r.result.content[0]!.text) as {
    address: string;
    rows: Array<Record<string, unknown>>;
    rowCount: number;
  };
  assert.equal(body.address, addr);
  assert.ok(body.rowCount >= 1);
  for (const row of body.rows) {
    assert.ok(
      String(row.sender).toLowerCase() === addr || String(row.recipient).toLowerCase() === addr,
    );
  }
});

test('address_history: requires an address', async () => {
  const r = await rpc(makeServer(), 'address_history', {});
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0]!.text, /address is required/);
});

test('object_history: returns versions newest-first', async () => {
  const objId = '0x00000000000000000000000000000000000000000000000000000000000b0001';
  const r = await rpc(makeServer(), 'object_history', { objectId: objId });
  const body = JSON.parse(r.result.content[0]!.text) as {
    rows: Array<Record<string, unknown>>;
    rowCount: number;
  };
  assert.equal(body.rowCount, 3);
  assert.equal(body.rows[0]!.version, 3);
  assert.equal(body.rows[2]!.version, 1);
});

test('object_history: requires an objectId', async () => {
  const r = await rpc(makeServer(), 'object_history', {});
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0]!.text, /objectId is required/);
});

test('whale_alert: defaults to >= $100k in 24h', async () => {
  const r = await rpc(makeServer(), 'whale_alert', {});
  const body = JSON.parse(r.result.content[0]!.text) as {
    minUsd: number;
    windowHours: number;
    rows: Array<Record<string, unknown>>;
  };
  assert.equal(body.minUsd, 100_000);
  assert.equal(body.windowHours, 24);
  // fixtures: tx_w1 (250k, 2h), tx_w2 (1.2M, 6h), tx_w3 (100k, 20h) qualify;
  // tx_w4 (500k, 72h) is outside 24h.
  assert.equal(body.rows.length, 3);
  for (const row of body.rows) {
    assert.ok(Number(row.amount_usd) >= 100_000);
  }
});

test('whale_alert: custom threshold and wider window', async () => {
  const r = await rpc(makeServer(), 'whale_alert', { minUsd: 400_000, windowHours: 96 });
  const body = JSON.parse(r.result.content[0]!.text) as {
    rows: Array<Record<string, unknown>>;
  };
  // >= 400k within 96h: tx_w2 (1.2M, 6h) and tx_w4 (500k, 72h).
  assert.equal(body.rows.length, 2);
});

test('heuristic LLM falls back to recent transfers for unknown questions', async () => {
  const llm = createHeuristicSqlLlm();
  const sql = await llm.toSql('the weather is nice today', '');
  assert.match(sql, /SELECT .* FROM transfers ORDER BY ts DESC LIMIT \d+/);
});
