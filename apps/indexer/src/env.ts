/**
 * Indexer env. Required in prod; test mode bypasses every required var so
 * unit tests don't need real credentials.
 */

export interface IndexerEnv {
  network: 'sui-mainnet' | 'sui-testnet' | 'sui-devnet';
  suiRpcUrl: string;
  mcpxPackageId: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  redisUrl: string | null;
  redisToken: string | null;
  pollIntervalMs: number;
  pageSize: number;
  testMode: boolean;
  healthPort: number;
}

export function loadEnv(envIn: NodeJS.ProcessEnv = process.env): IndexerEnv {
  const testMode = envIn.MCPX_INDEXER_TEST_MODE === '1';
  const network = (envIn.SUI_NETWORK ?? 'sui-testnet') as IndexerEnv['network'];
  if (!['sui-mainnet', 'sui-testnet', 'sui-devnet'].includes(network)) {
    throw new Error(`SUI_NETWORK must be sui-mainnet|sui-testnet|sui-devnet, got ${network}`);
  }
  const suiRpcUrl = envIn.SUI_RPC_URL ?? defaultRpcForNetwork(network);
  const pollIntervalMs = parseIntOr('INDEXER_POLL_INTERVAL_MS', envIn.INDEXER_POLL_INTERVAL_MS, 1000);
  const pageSize = parseIntOr('INDEXER_PAGE_SIZE', envIn.INDEXER_PAGE_SIZE, 50);
  const healthPort = parseIntOr('HEALTH_PORT', envIn.HEALTH_PORT, 3003);

  if (testMode) {
    return {
      network,
      suiRpcUrl,
      mcpxPackageId: envIn.MCPX_PACKAGE_ID ?? '0xtest',
      supabaseUrl: envIn.SUPABASE_URL ?? 'http://test',
      supabaseServiceRoleKey: envIn.SUPABASE_SERVICE_ROLE_KEY ?? 'test',
      redisUrl: envIn.UPSTASH_REDIS_URL ?? null,
      redisToken: envIn.UPSTASH_REDIS_TOKEN ?? null,
      pollIntervalMs,
      pageSize,
      testMode: true,
      healthPort,
    };
  }

  return {
    network,
    suiRpcUrl,
    mcpxPackageId: mustEnv(envIn, 'MCPX_PACKAGE_ID'),
    supabaseUrl: mustEnv(envIn, 'SUPABASE_URL'),
    supabaseServiceRoleKey: mustEnv(envIn, 'SUPABASE_SERVICE_ROLE_KEY'),
    redisUrl: envIn.UPSTASH_REDIS_URL ?? null,
    redisToken: envIn.UPSTASH_REDIS_TOKEN ?? null,
    pollIntervalMs,
    pageSize,
    testMode: false,
    healthPort,
  };
}

function mustEnv(env: NodeJS.ProcessEnv, name: string): string {
  const v = env[name];
  if (!v || v.length === 0) {
    throw new Error(`required env ${name} is not set (set MCPX_INDEXER_TEST_MODE=1 for tests)`);
  }
  return v;
}

function parseIntOr(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive integer`);
  return n;
}

function defaultRpcForNetwork(network: IndexerEnv['network']): string {
  switch (network) {
    case 'sui-mainnet':
      return 'https://fullnode.mainnet.sui.io:443';
    case 'sui-testnet':
      return 'https://fullnode.testnet.sui.io:443';
    case 'sui-devnet':
      return 'https://fullnode.devnet.sui.io:443';
  }
}
