import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStaticDefiDataSource,
  DEFAULT_SEED,
  type DefiSeed,
} from './data-source.js';
import { createSuiDefiDataServer } from './server.js';

function rpc(
  server: ReturnType<typeof createSuiDefiDataServer>,
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

function newServer() {
  return createSuiDefiDataServer({
    dataSource: createStaticDefiDataSource(),
  });
}

function body<T>(r: { result: { content: Array<{ text: string }> } }): T {
  return JSON.parse(r.result.content[0]!.text) as T;
}

test('static data source is deterministic across instances', async () => {
  const a = createStaticDefiDataSource();
  const b = createStaticDefiDataSource();
  const pa = await a.getPools({ protocol: 'all' });
  const pb = await b.getPools({ protocol: 'all' });
  assert.deepEqual(pa, pb);
  const ha = await a.getPoolHistory({
    protocol: 'cetus',
    poolId: '0xcetus_sui_usdc',
    days: 5,
  });
  const hb = await b.getPoolHistory({
    protocol: 'cetus',
    poolId: '0xcetus_sui_usdc',
    days: 5,
  });
  assert.deepEqual(ha, hb);
});

test('pools returns normalized shape and respects protocol + limit', async () => {
  const server = newServer();
  const all = await rpc(server, 'pools', {});
  const allBody = body<{
    count: number;
    pools: Array<{
      protocol: string;
      poolId: string;
      tokenA: string;
      tokenB: string;
      tvlUsd: number;
      apr: number;
      volume24hUsd: number;
    }>;
  }>(all);
  assert.equal(all.result.isError, false);
  assert.equal(allBody.count, DEFAULT_SEED.pools.length);
  const first = allBody.pools[0]!;
  assert.deepEqual(Object.keys(first).sort(), [
    'apr',
    'poolId',
    'protocol',
    'tokenA',
    'tokenB',
    'tvlUsd',
    'volume24hUsd',
  ]);

  const cetus = await rpc(server, 'pools', { protocol: 'cetus', limit: 1 });
  const cetusBody = body<{ pools: Array<{ protocol: string }> }>(cetus);
  assert.equal(cetusBody.pools.length, 1);
  assert.equal(cetusBody.pools[0]!.protocol, 'cetus');
});

test('pools rejects an unknown protocol', async () => {
  const r = await rpc(newServer(), 'pools', { protocol: 'uniswap' });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0]!.text, /protocol must be one of/);
});

test('prices returns one entry per requested symbol, unknown → zero', async () => {
  const r = await rpc(newServer(), 'prices', {
    symbols: ['sui', 'USDC', 'NOPE'],
  });
  const b = body<{
    count: number;
    prices: Array<{ symbol: string; priceUsd: number; source: string; ts: string }>;
  }>(r);
  assert.equal(b.count, 3);
  assert.equal(b.prices[0]!.symbol, 'SUI');
  assert.ok(b.prices[0]!.priceUsd > 0);
  assert.equal(b.prices[1]!.symbol, 'USDC');
  assert.equal(b.prices[2]!.priceUsd, 0);
  assert.match(b.prices[2]!.source, /unknown/);
});

test('prices errors when symbols missing or empty', async () => {
  const missing = await rpc(newServer(), 'prices', {});
  assert.equal(missing.result.isError, true);
  assert.match(missing.result.content[0]!.text, /non-empty array/);
  const empty = await rpc(newServer(), 'prices', { symbols: [] });
  assert.equal(empty.result.isError, true);
});

test('pool_history honours days and yields ascending dated points', async () => {
  const r = await rpc(newServer(), 'pool_history', {
    protocol: 'bluefin',
    poolId: '0xbluefin_sui_usdc',
    days: 4,
  });
  const b = body<{
    history: Array<{ date: string; tvlUsd: number; volumeUsd: number; apr: number }>;
  }>(r);
  assert.equal(b.history.length, 4);
  const dates = b.history.map((p) => p.date);
  assert.deepEqual(dates, [...dates].sort());
  for (const p of b.history) {
    assert.ok(p.tvlUsd > 0 && p.volumeUsd > 0 && p.apr > 0);
  }

  const dflt = await rpc(newServer(), 'pool_history', {
    protocol: 'bluefin',
    poolId: '0xbluefin_sui_usdc',
  });
  assert.equal(body<{ history: unknown[] }>(dflt).history.length, 7);
});

test('pool_history errors on missing poolId and on unknown pool', async () => {
  const missing = await rpc(newServer(), 'pool_history', {
    protocol: 'cetus',
  });
  assert.equal(missing.result.isError, true);
  assert.match(missing.result.content[0]!.text, /poolId is required/);

  const unknown = await rpc(newServer(), 'pool_history', {
    protocol: 'cetus',
    poolId: '0xdoes_not_exist',
  });
  assert.equal(unknown.result.isError, true);
  assert.match(unknown.result.content[0]!.text, /unknown pool/);
});

test('swap_quote returns a normalized quote with sane numbers', async () => {
  const r = await rpc(newServer(), 'swap_quote', {
    tokenIn: 'SUI',
    tokenOut: 'USDC',
    amountIn: '1000000000', // 1000 SUI atomic (6dp)
  });
  const b = body<{
    protocol: string;
    amountOut: string;
    priceImpactPct: number;
    route: string[];
    feeUsd: number;
  }>(r);
  assert.equal(b.protocol, 'cetus');
  assert.deepEqual(b.route, ['SUI', 'USDC']);
  assert.ok(BigInt(b.amountOut) > 0n);
  assert.ok(b.priceImpactPct >= 0 && b.priceImpactPct <= 50);
  assert.ok(b.feeUsd > 0);
});

test('swap_quote errors on missing args and non-integer amountIn', async () => {
  const missing = await rpc(newServer(), 'swap_quote', {
    tokenIn: 'SUI',
    tokenOut: 'USDC',
  });
  assert.equal(missing.result.isError, true);
  assert.match(missing.result.content[0]!.text, /amountIn is required/);

  const bad = await rpc(newServer(), 'swap_quote', {
    tokenIn: 'SUI',
    tokenOut: 'USDC',
    amountIn: '1.5',
  });
  assert.equal(bad.result.isError, true);
  assert.match(bad.result.content[0]!.text, /atomic integer string/);
});

test('unknown tool path returns a JSON-RPC 404 error', async () => {
  const res = await Promise.resolve(
    newServer().fetch(
      new Request('http://s/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 9,
          method: 'tools/call',
          params: { name: 'nope', arguments: {} },
        }),
      }),
    ),
  );
  assert.equal(res.status, 404);
  const j = (await res.json()) as { error: { message: string } };
  assert.match(j.error.message, /Unknown tool: nope/);
});

test('manifest exposes all four tools with string prices + free tiers', () => {
  const m = newServer().manifest();
  const names = m.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ['pool_history', 'pools', 'prices', 'swap_quote']);
  const prices = m.tools.find((t) => t.name === 'prices');
  assert.equal(prices?.priceAtomic, '1000');
  assert.equal(prices?.freeTierCallsPerUser, 5);
  const poolHistory = m.tools.find((t) => t.name === 'pool_history');
  assert.equal(poolHistory?.priceAtomic, '3000');
  assert.equal(poolHistory?.freeTierCallsPerUser, 0);
});

test('a custom seed flows through the server', async () => {
  const seed: DefiSeed = {
    pools: [
      {
        protocol: 'deepbook',
        poolId: '0xonly',
        tokenA: 'AAA',
        tokenB: 'BBB',
        tvlUsd: 100,
        apr: 0.5,
        volume24hUsd: 50,
      },
    ],
    prices: [{ symbol: 'AAA', priceUsd: 2, source: 'seed' }],
  };
  const server = createSuiDefiDataServer({
    dataSource: createStaticDefiDataSource(seed),
  });
  const pools = body<{ count: number; pools: Array<{ poolId: string }> }>(
    await rpc(server, 'pools', {}),
  );
  assert.equal(pools.count, 1);
  assert.equal(pools.pools[0]!.poolId, '0xonly');
  const p = body<{ prices: Array<{ priceUsd: number }> }>(
    await rpc(server, 'prices', { symbols: ['AAA'] }),
  );
  assert.equal(p.prices[0]!.priceUsd, 2);
});
