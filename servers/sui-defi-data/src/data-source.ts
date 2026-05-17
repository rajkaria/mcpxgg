/**
 * DefiDataSource seam (S5-T02 — normalization layer).
 *
 * Every Sui DeFi protocol (Cetus, Bluefin, Scallop, Navi, DeepBook) exposes a
 * bespoke shape for pools/prices/quotes. This module is the single place that
 * normalizes them into the four shapes the MCP tools return, so tool logic
 * never sees a protocol-specific payload.
 *
 * Two implementations, mirroring walrus-search's embedder/vector-store seam:
 *   - createStaticDefiDataSource(seed)  deterministic in-memory fixture; the
 *     default when no env is configured (server boots + demos fully offline,
 *     CI stays hermetic).
 *   - createHttpDefiDataSource(env)     real impl that calls each protocol's
 *     public endpoint via fetch; gracefully degrades per-protocol on failure
 *     and falls back to the static fixture so a single dead upstream never
 *     takes the whole tool down.
 */

export type Protocol =
  | 'cetus'
  | 'bluefin'
  | 'scallop'
  | 'navi'
  | 'deepbook';

export type ProtocolFilter = Protocol | 'all';

export const ALL_PROTOCOLS: readonly Protocol[] = [
  'cetus',
  'bluefin',
  'scallop',
  'navi',
  'deepbook',
] as const;

/** Normalized liquidity pool, identical across every protocol. */
export interface NormalizedPool {
  protocol: Protocol;
  poolId: string;
  tokenA: string;
  tokenB: string;
  tvlUsd: number;
  apr: number;
  volume24hUsd: number;
}

/** Normalized spot price for a single token symbol. */
export interface NormalizedPrice {
  symbol: string;
  priceUsd: number;
  source: string;
  ts: string;
}

/** One day of a pool's time series. */
export interface PoolHistoryPoint {
  date: string;
  tvlUsd: number;
  volumeUsd: number;
  apr: number;
}

/** Best-route swap quote. */
export interface SwapQuote {
  protocol: Protocol;
  amountOut: string;
  priceImpactPct: number;
  route: string[];
  feeUsd: number;
}

export interface GetPoolsParams {
  protocol?: ProtocolFilter;
  limit?: number;
}

export interface GetPoolHistoryParams {
  protocol: Protocol;
  poolId: string;
  days?: number;
}

export interface GetSwapQuoteParams {
  tokenIn: string;
  tokenOut: string;
  /** Atomic input amount, decimal string (token's smallest unit). */
  amountIn: string;
  protocol?: Protocol;
}

/** Normalized facade every tool depends on. */
export interface DefiDataSource {
  getPools(params: GetPoolsParams): Promise<NormalizedPool[]>;
  getPrices(symbols: string[]): Promise<NormalizedPrice[]>;
  getPoolHistory(params: GetPoolHistoryParams): Promise<PoolHistoryPoint[]>;
  getSwapQuote(params: GetSwapQuoteParams): Promise<SwapQuote>;
}

// ---------------------------------------------------------------------------
// Static (deterministic) source — default + test double.
// ---------------------------------------------------------------------------

export interface DefiSeed {
  pools: NormalizedPool[];
  prices: Array<Omit<NormalizedPrice, 'ts'> & { ts?: string }>;
}

/** A realistic small fixture across Cetus / Bluefin / DeepBook. */
export const DEFAULT_SEED: DefiSeed = {
  pools: [
    {
      protocol: 'cetus',
      poolId: '0xcetus_sui_usdc',
      tokenA: 'SUI',
      tokenB: 'USDC',
      tvlUsd: 18_400_000,
      apr: 0.142,
      volume24hUsd: 7_900_000,
    },
    {
      protocol: 'cetus',
      poolId: '0xcetus_cetus_sui',
      tokenA: 'CETUS',
      tokenB: 'SUI',
      tvlUsd: 4_200_000,
      apr: 0.318,
      volume24hUsd: 1_350_000,
    },
    {
      protocol: 'bluefin',
      poolId: '0xbluefin_sui_usdc',
      tokenA: 'SUI',
      tokenB: 'USDC',
      tvlUsd: 9_600_000,
      apr: 0.171,
      volume24hUsd: 5_100_000,
    },
    {
      protocol: 'deepbook',
      poolId: '0xdeepbook_deep_usdc',
      tokenA: 'DEEP',
      tokenB: 'USDC',
      tvlUsd: 3_050_000,
      apr: 0.094,
      volume24hUsd: 2_200_000,
    },
    {
      protocol: 'scallop',
      poolId: '0xscallop_usdc_lend',
      tokenA: 'USDC',
      tokenB: 'sUSDC',
      tvlUsd: 12_750_000,
      apr: 0.061,
      volume24hUsd: 880_000,
    },
    {
      protocol: 'navi',
      poolId: '0xnavi_sui_lend',
      tokenA: 'SUI',
      tokenB: 'nSUI',
      tvlUsd: 6_300_000,
      apr: 0.048,
      volume24hUsd: 410_000,
    },
  ],
  prices: [
    { symbol: 'SUI', priceUsd: 3.41, source: 'static-fixture' },
    { symbol: 'USDC', priceUsd: 1.0, source: 'static-fixture' },
    { symbol: 'CETUS', priceUsd: 0.082, source: 'static-fixture' },
    { symbol: 'DEEP', priceUsd: 0.0214, source: 'static-fixture' },
    { symbol: 'WAL', priceUsd: 0.47, source: 'static-fixture' },
  ],
};

/** Deterministic ts so fixtures are byte-stable across runs. */
const FIXED_TS = '2026-01-01T00:00:00.000Z';

/**
 * Deterministic FNV-1a over a string → unsigned 32-bit. Used to derive stable
 * pseudo-variation in history/quotes without any randomness (hermetic CI).
 */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function createStaticDefiDataSource(
  seed: DefiSeed = DEFAULT_SEED,
): DefiDataSource {
  const pools = seed.pools.map((p) => ({ ...p }));
  const prices = new Map<string, NormalizedPrice>(
    seed.prices.map((p) => [
      p.symbol.toUpperCase(),
      { symbol: p.symbol.toUpperCase(), priceUsd: p.priceUsd, source: p.source, ts: p.ts ?? FIXED_TS },
    ]),
  );

  return {
    async getPools({ protocol = 'all', limit }) {
      let out = pools;
      if (protocol !== 'all') {
        out = out.filter((p) => p.protocol === protocol);
      }
      if (typeof limit === 'number' && Number.isFinite(limit) && limit >= 0) {
        out = out.slice(0, Math.floor(limit));
      }
      return out.map((p) => ({ ...p }));
    },

    async getPrices(symbols) {
      return symbols.map((raw) => {
        const sym = raw.toUpperCase();
        const hit = prices.get(sym);
        if (hit) return { ...hit };
        return { symbol: sym, priceUsd: 0, source: 'static-fixture:unknown', ts: FIXED_TS };
      });
    },

    async getPoolHistory({ protocol, poolId, days = 7 }) {
      const pool = pools.find(
        (p) => p.protocol === protocol && p.poolId === poolId,
      );
      if (!pool) {
        throw new Error(`unknown pool ${protocol}:${poolId}`);
      }
      const n = Math.max(1, Math.floor(days));
      const points: PoolHistoryPoint[] = [];
      // Walk backwards from FIXED_TS so the series is deterministic.
      const base = Date.parse(FIXED_TS);
      for (let i = n - 1; i >= 0; i--) {
        const dayMs = base - i * 86_400_000;
        const date = new Date(dayMs).toISOString().slice(0, 10);
        // Deterministic ±15% wobble keyed off poolId+day.
        const seedHash = hash(`${poolId}:${date}`);
        const wobble = ((seedHash % 30) - 15) / 100; // [-0.15, +0.15)
        points.push({
          date,
          tvlUsd: round2(pool.tvlUsd * (1 + wobble)),
          volumeUsd: round2(pool.volume24hUsd * (1 + wobble * 1.5)),
          apr: round2(pool.apr * (1 + wobble) * 1000) / 1000,
        });
      }
      return points;
    },

    async getSwapQuote({ tokenIn, tokenOut, amountIn, protocol }) {
      const inSym = tokenIn.toUpperCase();
      const outSym = tokenOut.toUpperCase();
      let amount: bigint;
      try {
        amount = BigInt(amountIn);
      } catch {
        throw new Error(`amountIn must be an atomic integer string, got "${amountIn}"`);
      }
      if (amount <= 0n) throw new Error('amountIn must be positive');

      // Prefer an explicit protocol; else pick the deepest pool that can route.
      const candidates = pools.filter(
        (p) =>
          (!protocol || p.protocol === protocol) &&
          ((p.tokenA === inSym && p.tokenB === outSym) ||
            (p.tokenA === outSym && p.tokenB === inSym)),
      );
      const direct = candidates.sort((a, b) => b.tvlUsd - a.tvlUsd)[0];

      const inPrice = prices.get(inSym)?.priceUsd ?? 1;
      const outPrice = prices.get(outSym)?.priceUsd ?? 1;
      if (outPrice <= 0) {
        throw new Error(`no price for ${outSym}; cannot quote`);
      }

      // Assume both tokens are 6-decimal for the demo math; real impl reads
      // on-chain metadata. amountIn is atomic → human via 1e6.
      const amountInHuman = Number(amount) / 1e6;
      const notionalUsd = amountInHuman * inPrice;

      const chosen: Protocol = direct?.protocol ?? protocol ?? 'cetus';
      const route = direct
        ? [inSym, outSym]
        : [inSym, 'SUI', outSym]; // synthetic 2-hop when no direct pool

      // Price impact scales with notional vs pool TVL (bounded).
      const tvl = direct?.tvlUsd ?? 1_000_000;
      const priceImpactPct = round2(
        Math.min(50, (notionalUsd / tvl) * 100 + (route.length - 2) * 0.05),
      );
      const feePct = chosen === 'deepbook' ? 0.0005 : 0.003;
      const feeUsd = round2(notionalUsd * feePct);

      const grossOutHuman = (notionalUsd - feeUsd) / outPrice;
      const netOutHuman = grossOutHuman * (1 - priceImpactPct / 100);
      const amountOut = BigInt(Math.max(0, Math.round(netOutHuman * 1e6))).toString();

      return {
        protocol: chosen,
        amountOut,
        priceImpactPct,
        route,
        feeUsd,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// HTTP source — real protocol endpoints, graceful per-protocol degradation.
// ---------------------------------------------------------------------------

export interface DefiHttpEnv {
  /** Per-protocol pool/stats base URLs (public endpoints). */
  DEFI_CETUS_URL?: string;
  DEFI_BLUEFIN_URL?: string;
  DEFI_SCALLOP_URL?: string;
  DEFI_NAVI_URL?: string;
  DEFI_DEEPBOOK_URL?: string;
  /** Aggregated spot-price oracle (e.g. Pyth/CoinGecko proxy). */
  DEFI_PRICE_URL?: string;
}

const PROTOCOL_ENV_KEY: Record<Protocol, keyof DefiHttpEnv> = {
  cetus: 'DEFI_CETUS_URL',
  bluefin: 'DEFI_BLUEFIN_URL',
  scallop: 'DEFI_SCALLOP_URL',
  navi: 'DEFI_NAVI_URL',
  deepbook: 'DEFI_DEEPBOOK_URL',
};

/** True if at least one upstream URL is configured. */
export function hasHttpDefiEnv(env: DefiHttpEnv): boolean {
  return (
    Boolean(env.DEFI_PRICE_URL) ||
    ALL_PROTOCOLS.some((p) => Boolean(env[PROTOCOL_ENV_KEY[p]]))
  );
}

interface UpstreamPool {
  poolId?: string;
  pool_id?: string;
  id?: string;
  tokenA?: string;
  tokenB?: string;
  symbolA?: string;
  symbolB?: string;
  tvlUsd?: number;
  tvl_usd?: number;
  tvl?: number;
  apr?: number;
  apy?: number;
  volume24hUsd?: number;
  volume_24h_usd?: number;
  volume24h?: number;
}

function num(...vals: Array<number | undefined>): number {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return 0;
}

function str(...vals: Array<string | undefined>): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return '';
}

function normalizeUpstreamPool(
  protocol: Protocol,
  raw: UpstreamPool,
): NormalizedPool {
  return {
    protocol,
    poolId: str(raw.poolId, raw.pool_id, raw.id),
    tokenA: str(raw.tokenA, raw.symbolA).toUpperCase(),
    tokenB: str(raw.tokenB, raw.symbolB).toUpperCase(),
    tvlUsd: num(raw.tvlUsd, raw.tvl_usd, raw.tvl),
    apr: num(raw.apr, raw.apy),
    volume24hUsd: num(raw.volume24hUsd, raw.volume_24h_usd, raw.volume24h),
  };
}

async function fetchJson(url: string, timeoutMs = 5000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`http ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Real implementation. Each protocol call is independently try/caught and
 * falls back to the static fixture so one dead upstream degrades gracefully
 * instead of failing the whole tool.
 */
export function createHttpDefiDataSource(
  env: DefiHttpEnv,
  fallback: DefiDataSource = createStaticDefiDataSource(),
): DefiDataSource {
  async function poolsForProtocol(p: Protocol): Promise<NormalizedPool[]> {
    const baseUrl = env[PROTOCOL_ENV_KEY[p]];
    if (!baseUrl) {
      return fallback.getPools({ protocol: p });
    }
    try {
      const body = await fetchJson(`${baseUrl.replace(/\/$/, '')}/pools`);
      const list = Array.isArray(body)
        ? body
        : Array.isArray((body as { pools?: unknown }).pools)
          ? ((body as { pools: UpstreamPool[] }).pools)
          : [];
      return (list as UpstreamPool[]).map((r) => normalizeUpstreamPool(p, r));
    } catch {
      // Graceful degradation: serve the fixture slice for this protocol.
      return fallback.getPools({ protocol: p });
    }
  }

  return {
    async getPools({ protocol = 'all', limit }) {
      const targets =
        protocol === 'all' ? ALL_PROTOCOLS : ([protocol] as Protocol[]);
      const batches = await Promise.all(targets.map((p) => poolsForProtocol(p)));
      let out = batches.flat();
      if (typeof limit === 'number' && Number.isFinite(limit) && limit >= 0) {
        out = out.slice(0, Math.floor(limit));
      }
      return out;
    },

    async getPrices(symbols) {
      const url = env.DEFI_PRICE_URL;
      if (!url) return fallback.getPrices(symbols);
      try {
        const body = await fetchJson(
          `${url.replace(/\/$/, '')}/prices?symbols=${encodeURIComponent(symbols.join(','))}`,
        );
        const map = body as Record<string, { priceUsd?: number; price?: number }>;
        const ts = new Date().toISOString();
        return symbols.map((raw) => {
          const sym = raw.toUpperCase();
          const entry = map[sym] ?? map[raw];
          const price = num(entry?.priceUsd, entry?.price);
          if (price > 0) {
            return { symbol: sym, priceUsd: price, source: url, ts };
          }
          return fallbackPrice(sym);
        });
      } catch {
        return fallback.getPrices(symbols);
      }

      function fallbackPrice(sym: string): NormalizedPrice {
        return { symbol: sym, priceUsd: 0, source: 'http:degraded', ts: new Date().toISOString() };
      }
    },

    async getPoolHistory(params) {
      const baseUrl = env[PROTOCOL_ENV_KEY[params.protocol]];
      if (!baseUrl) return fallback.getPoolHistory(params);
      try {
        const days = Math.max(1, Math.floor(params.days ?? 7));
        const body = await fetchJson(
          `${baseUrl.replace(/\/$/, '')}/pools/${encodeURIComponent(params.poolId)}/history?days=${days}`,
        );
        const list = Array.isArray(body)
          ? body
          : Array.isArray((body as { history?: unknown }).history)
            ? (body as { history: unknown[] }).history
            : [];
        return (list as Array<Record<string, unknown>>).map((r) => ({
          date: String(r.date ?? ''),
          tvlUsd: num(r.tvlUsd as number, r.tvl_usd as number),
          volumeUsd: num(r.volumeUsd as number, r.volume_usd as number),
          apr: num(r.apr as number, r.apy as number),
        }));
      } catch {
        return fallback.getPoolHistory(params);
      }
    },

    async getSwapQuote(params) {
      const baseUrl = params.protocol
        ? env[PROTOCOL_ENV_KEY[params.protocol]]
        : undefined;
      if (!baseUrl) return fallback.getSwapQuote(params);
      try {
        const qs = new URLSearchParams({
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          amountIn: params.amountIn,
        });
        const body = (await fetchJson(
          `${baseUrl.replace(/\/$/, '')}/quote?${qs.toString()}`,
        )) as {
          protocol?: string;
          amountOut?: string | number;
          priceImpactPct?: number;
          route?: string[];
          feeUsd?: number;
        };
        return {
          protocol: (params.protocol ?? (body.protocol as Protocol)) ?? 'cetus',
          amountOut: String(body.amountOut ?? '0'),
          priceImpactPct: num(body.priceImpactPct),
          route: Array.isArray(body.route)
            ? body.route
            : [params.tokenIn.toUpperCase(), params.tokenOut.toUpperCase()],
          feeUsd: num(body.feeUsd),
        };
      } catch {
        return fallback.getSwapQuote(params);
      }
    },
  };
}

/**
 * Default selection: HTTP when any upstream env is set, else the deterministic
 * static fixture (server boots + demos fully offline, CI hermetic).
 */
export function dataSourceFromEnv(
  env: DefiHttpEnv = process.env as DefiHttpEnv,
): DefiDataSource {
  if (hasHttpDefiEnv(env)) return createHttpDefiDataSource(env);
  return createStaticDefiDataSource();
}
