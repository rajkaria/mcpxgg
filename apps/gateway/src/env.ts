/**
 * Gateway env. Fail fast at boot. Test mode (`MCPX_GATEWAY_TEST_MODE=1`)
 * relaxes required chain/credential vars so the app can run against the
 * in-memory store + an injected facilitator.
 */

export interface GatewayEnv {
  port: number;
  chainId: 'sui';
  network: 'sui-mainnet' | 'sui-testnet' | 'sui-devnet';
  facilitatorUrl: string;
  /** USDsui coin type tag, echoed in PaymentDetails. */
  usdsuiTypeTag: string;
  /** When true, gateway calls facilitator /settle out-of-band (does not block
   *  the tool response on settlement finality). Default false. */
  settleAsync: boolean;
  /**
   * Pay-per-output (S7-T04) ceiling. A streaming call's quoted max =
   * `tool.priceAtomic × streamMaxChunks`. Per-chunk cost defaults to
   * `tool.priceAtomic` unless the upstream chunk supplies its own
   * `priceAtomic`. The metered sum (≤ ceiling) is what is debited.
   * Default 1000. */
  streamMaxChunks: number;
  supabaseUrl: string | null;
  supabaseServiceRoleKey: string | null;
  redisUrl: string | null;
  redisToken: string | null;
  walrusPublisherUrl: string | null;
  walrusAggregatorUrl: string | null;
  attribution: string;
  testMode: boolean;
}

const NETWORKS = ['sui-mainnet', 'sui-testnet', 'sui-devnet'] as const;

export function loadEnv(envIn: NodeJS.ProcessEnv = process.env): GatewayEnv {
  const testMode = envIn.MCPX_GATEWAY_TEST_MODE === '1';
  const port = parseIntOr('PORT', envIn.PORT, 3003);
  const network = (envIn.SUI_NETWORK ?? 'sui-testnet') as GatewayEnv['network'];
  if (!NETWORKS.includes(network)) {
    throw new Error(`SUI_NETWORK must be one of ${NETWORKS.join('|')}, got ${network}`);
  }
  const settleAsync = envIn.MCPX_SETTLE_ASYNC === '1';
  const streamMaxChunks = parseIntOr(
    'MCPX_STREAM_MAX_CHUNKS',
    envIn.MCPX_STREAM_MAX_CHUNKS,
    1000,
  );
  const attribution = envIn.MCPX_ATTRIBUTION ?? 'Powered by mcpxgg';

  if (testMode) {
    return {
      port,
      chainId: 'sui',
      network,
      facilitatorUrl: envIn.FACILITATOR_URL ?? 'http://facilitator.test',
      usdsuiTypeTag: envIn.USDSUI_COIN_TYPE ?? '0xtest::usdsui::USDSUI',
      settleAsync,
      streamMaxChunks,
      supabaseUrl: null,
      supabaseServiceRoleKey: null,
      redisUrl: null,
      redisToken: null,
      walrusPublisherUrl: null,
      walrusAggregatorUrl: null,
      attribution,
      testMode: true,
    };
  }

  return {
    port,
    chainId: 'sui',
    network,
    facilitatorUrl: mustEnv(envIn, 'FACILITATOR_URL'),
    usdsuiTypeTag: mustEnv(envIn, 'USDSUI_COIN_TYPE'),
    settleAsync,
    streamMaxChunks,
    supabaseUrl: mustEnv(envIn, 'SUPABASE_URL'),
    supabaseServiceRoleKey: mustEnv(envIn, 'SUPABASE_SERVICE_ROLE_KEY'),
    redisUrl: envIn.UPSTASH_REDIS_REST_URL ?? null,
    redisToken: envIn.UPSTASH_REDIS_REST_TOKEN ?? null,
    walrusPublisherUrl: envIn.WALRUS_PUBLISHER_URL ?? null,
    walrusAggregatorUrl: envIn.WALRUS_AGGREGATOR_URL ?? null,
    attribution,
    testMode: false,
  };
}

function mustEnv(env: NodeJS.ProcessEnv, name: string): string {
  const v = env[name];
  if (!v || v.length === 0) {
    throw new Error(`required env ${name} is not set (set MCPX_GATEWAY_TEST_MODE=1 for tests)`);
  }
  return v;
}

function parseIntOr(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive integer`);
  return n;
}
