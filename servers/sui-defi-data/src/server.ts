/**
 * sui-defi-data MCP server (S5-T01..T02). Tools per spec §10.2:
 *   pools         — list normalized liquidity pools across protocols
 *   prices        — spot USD prices for tokens
 *   pool_history  — daily time series for one pool
 *   swap_quote    — best-route swap quote
 *
 * The DefiDataSource is injected so tests are hermetic and prod can swap in
 * live Cetus/Bluefin/Scallop/Navi/DeepBook endpoints without touching tool
 * logic. Default is env-or-static (boots + demos fully offline).
 */

import { createMCPXServer, type MCPXServer } from '@mcpxgg/server';
import {
  dataSourceFromEnv,
  type DefiDataSource,
  type Protocol,
  type ProtocolFilter,
} from './data-source.js';

export interface SuiDefiDataDeps {
  dataSource?: DefiDataSource;
}

const PROTOCOL_VALUES = [
  'cetus',
  'bluefin',
  'scallop',
  'navi',
  'deepbook',
] as const;

function asProtocolFilter(v: unknown): ProtocolFilter {
  if (v === undefined || v === null || v === 'all') return 'all';
  const s = String(v);
  if ((PROTOCOL_VALUES as readonly string[]).includes(s)) return s as Protocol;
  throw new Error(
    `protocol must be one of ${PROTOCOL_VALUES.join(', ')}, all — got "${s}"`,
  );
}

function asProtocol(v: unknown): Protocol {
  const s = String(v ?? '');
  if (!(PROTOCOL_VALUES as readonly string[]).includes(s)) {
    throw new Error(
      `protocol must be one of ${PROTOCOL_VALUES.join(', ')} — got "${s}"`,
    );
  }
  return s as Protocol;
}

export function createSuiDefiDataServer(
  deps: SuiDefiDataDeps = {},
): MCPXServer {
  const ds = deps.dataSource ?? dataSourceFromEnv();

  const server = createMCPXServer({
    namespace: 'sui-defi-data',
    description:
      'Normalized Sui DeFi data — pools, prices, history and swap quotes across Cetus, Bluefin, Scallop, Navi and DeepBook.',
  });

  server.tool('pools', {
    description:
      'List normalized liquidity pools across Sui DeFi protocols (TVL, APR, 24h volume).',
    inputSchema: {
      type: 'object',
      properties: {
        protocol: {
          type: 'string',
          enum: [...PROTOCOL_VALUES, 'all'],
          description: 'Filter by protocol, or "all" (default).',
        },
        limit: { type: 'number', description: 'Max pools to return.' },
      },
    },
    pricing: { perCallAtomic: 2_000n, freeTierCallsPerUser: 3 },
    handler: async (args) => {
      const protocol = asProtocolFilter(args.protocol);
      const limit =
        args.limit !== undefined && Number.isFinite(args.limit)
          ? Number(args.limit)
          : undefined;
      const pools = await ds.getPools({
        protocol,
        ...(limit !== undefined ? { limit } : {}),
      });
      return { protocol, count: pools.length, pools };
    },
  });

  server.tool('prices', {
    description: 'Spot USD prices for one or more token symbols.',
    inputSchema: {
      type: 'object',
      properties: {
        symbols: {
          type: 'array',
          items: { type: 'string' },
          description: 'Token symbols, e.g. ["SUI","USDC"].',
        },
      },
      required: ['symbols'],
    },
    pricing: { perCallAtomic: 1_000n, freeTierCallsPerUser: 5 },
    handler: async (args) => {
      const raw = args.symbols;
      if (!Array.isArray(raw) || raw.length === 0) {
        throw new Error('symbols must be a non-empty array');
      }
      const symbols = raw.map((s) => String(s));
      const prices = await ds.getPrices(symbols);
      return { count: prices.length, prices };
    },
  });

  server.tool('pool_history', {
    description: 'Daily TVL / volume / APR time series for a single pool.',
    inputSchema: {
      type: 'object',
      properties: {
        protocol: { type: 'string', enum: [...PROTOCOL_VALUES] },
        poolId: { type: 'string' },
        days: { type: 'number', description: 'Default 7.' },
      },
      required: ['protocol', 'poolId'],
    },
    pricing: { perCallAtomic: 3_000n },
    handler: async (args) => {
      const protocol = asProtocol(args.protocol);
      const poolId = String(args.poolId ?? '');
      if (!poolId) throw new Error('poolId is required');
      const days =
        args.days !== undefined && Number.isFinite(args.days)
          ? Number(args.days)
          : 7;
      const history = await ds.getPoolHistory({ protocol, poolId, days });
      return { protocol, poolId, days, history };
    },
  });

  server.tool('swap_quote', {
    description:
      'Best-route swap quote for tokenIn → tokenOut (amountIn is atomic).',
    inputSchema: {
      type: 'object',
      properties: {
        tokenIn: { type: 'string' },
        tokenOut: { type: 'string' },
        amountIn: {
          type: 'string',
          description: 'Atomic input amount (token smallest unit).',
        },
        protocol: { type: 'string', enum: [...PROTOCOL_VALUES] },
      },
      required: ['tokenIn', 'tokenOut', 'amountIn'],
    },
    pricing: { perCallAtomic: 2_000n },
    handler: async (args) => {
      const tokenIn = String(args.tokenIn ?? '');
      const tokenOut = String(args.tokenOut ?? '');
      const amountIn = String(args.amountIn ?? '');
      if (!tokenIn || !tokenOut) {
        throw new Error('tokenIn and tokenOut are required');
      }
      if (!amountIn) throw new Error('amountIn is required');
      const protocol =
        args.protocol !== undefined ? asProtocol(args.protocol) : undefined;
      const quote = await ds.getSwapQuote({
        tokenIn,
        tokenOut,
        amountIn,
        ...(protocol ? { protocol } : {}),
      });
      return { ...quote };
    },
  });

  return server;
}
