/**
 * Quality-oracle env. Required in prod; test mode bypasses everything so
 * unit tests never need real credentials (the compute core is pure and
 * doesn't touch this at all).
 */

export interface OracleEnv {
  network: 'sui-mainnet' | 'sui-testnet' | 'sui-devnet';
  suiRpcUrl: string;
  mcpxPackageId: string;
  /** Owned OracleCap object id held by the oracle signing key. */
  oracleCapId: string;
  /** suiprivkey1... or 0x-hex ed25519 secret for the oracle address. */
  oraclePrivateKey: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  /** Loop cadence check interval in ms (the *window* is always 6h). */
  pollIntervalMs: number;
  testMode: boolean;
  healthPort: number;
}

export function loadEnv(envIn: NodeJS.ProcessEnv = process.env): OracleEnv {
  const testMode = envIn.MCPX_ORACLE_TEST_MODE === '1';
  const network = (envIn.SUI_NETWORK ?? 'sui-testnet') as OracleEnv['network'];
  if (!['sui-mainnet', 'sui-testnet', 'sui-devnet'].includes(network)) {
    throw new Error(`SUI_NETWORK must be sui-mainnet|sui-testnet|sui-devnet, got ${network}`);
  }
  const suiRpcUrl = envIn.SUI_RPC_URL ?? defaultRpcForNetwork(network);
  const pollIntervalMs = parseIntOr(
    'ORACLE_POLL_INTERVAL_MS',
    envIn.ORACLE_POLL_INTERVAL_MS,
    5 * 60 * 1000,
  );
  const healthPort = parseIntOr('HEALTH_PORT', envIn.HEALTH_PORT, 3004);

  if (testMode) {
    return {
      network,
      suiRpcUrl,
      mcpxPackageId: envIn.MCPX_PACKAGE_ID ?? '0xtest',
      oracleCapId: envIn.MCPX_ORACLE_CAP_ID ?? '0xcap',
      oraclePrivateKey: envIn.MCPX_ORACLE_PRIVATE_KEY ?? '0x00',
      supabaseUrl: envIn.SUPABASE_URL ?? 'http://test',
      supabaseServiceRoleKey: envIn.SUPABASE_SERVICE_ROLE_KEY ?? 'test',
      pollIntervalMs,
      testMode: true,
      healthPort,
    };
  }

  return {
    network,
    suiRpcUrl,
    mcpxPackageId: mustEnv(envIn, 'MCPX_PACKAGE_ID'),
    oracleCapId: mustEnv(envIn, 'MCPX_ORACLE_CAP_ID'),
    oraclePrivateKey: mustEnv(envIn, 'MCPX_ORACLE_PRIVATE_KEY'),
    supabaseUrl: mustEnv(envIn, 'SUPABASE_URL'),
    supabaseServiceRoleKey: mustEnv(envIn, 'SUPABASE_SERVICE_ROLE_KEY'),
    pollIntervalMs,
    testMode: false,
    healthPort,
  };
}

function mustEnv(env: NodeJS.ProcessEnv, name: string): string {
  const v = env[name];
  if (!v || v.length === 0) {
    throw new Error(`required env ${name} is not set (set MCPX_ORACLE_TEST_MODE=1 for tests)`);
  }
  return v;
}

function parseIntOr(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive integer`);
  return n;
}

function defaultRpcForNetwork(network: OracleEnv['network']): string {
  switch (network) {
    case 'sui-mainnet':
      return 'https://fullnode.mainnet.sui.io:443';
    case 'sui-testnet':
      return 'https://fullnode.testnet.sui.io:443';
    case 'sui-devnet':
      return 'https://fullnode.devnet.sui.io:443';
  }
}
