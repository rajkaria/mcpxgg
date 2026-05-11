/**
 * Facilitator env. Fail fast at boot; never reach a request with bad config.
 *
 * Required in prod, optional for tests (`MCPX_FACILITATOR_TEST_MODE=1`).
 */

export interface FacilitatorEnv {
  port: number;
  network: 'sui-mainnet' | 'sui-testnet' | 'sui-devnet';
  suiRpcUrl: string;
  mcpxPackageId: string;
  platformConfigId: string;
  treasuryId: string;
  insuranceId: string;
  registryId: string;
  usdsuiTypeTag: string;
  gasStationKey: string | null; // bech32 sui secret or hex; null in test mode
  gasStationDailyBudgetSui: bigint;
  gasStationRateLimitPerMin: number;
  testMode: boolean;
}

export function loadEnv(envIn: NodeJS.ProcessEnv = process.env): FacilitatorEnv {
  const testMode = envIn.MCPX_FACILITATOR_TEST_MODE === '1';
  const port = parseIntOr('PORT', envIn.PORT, 3002);
  const network = (envIn.SUI_NETWORK ?? 'sui-testnet') as FacilitatorEnv['network'];
  if (!['sui-mainnet', 'sui-testnet', 'sui-devnet'].includes(network)) {
    throw new Error(`SUI_NETWORK must be sui-mainnet|sui-testnet|sui-devnet, got ${network}`);
  }

  const suiRpcUrl =
    envIn.SUI_RPC_URL ?? defaultRpcForNetwork(network);

  const gasStationDailyBudgetSui = BigInt(
    envIn.GAS_STATION_DAILY_BUDGET_MIST ?? '1000000000', // 1 SUI default
  );
  const gasStationRateLimitPerMin = parseIntOr(
    'GAS_STATION_RATE_LIMIT_PER_MIN',
    envIn.GAS_STATION_RATE_LIMIT_PER_MIN,
    60,
  );

  if (testMode) {
    return {
      port,
      network,
      suiRpcUrl,
      mcpxPackageId: envIn.MCPX_PACKAGE_ID ?? '0xtest',
      platformConfigId: envIn.MCPX_PLATFORM_CONFIG_ID ?? '0xtestcfg',
      treasuryId: envIn.MCPX_TREASURY_ID ?? '0xtesttreasury',
      insuranceId: envIn.MCPX_INSURANCE_ID ?? '0xtestinsurance',
      registryId: envIn.MCPX_REGISTRY_ID ?? '0xtestregistry',
      usdsuiTypeTag: envIn.USDSUI_COIN_TYPE ?? '0xtest::usdsui::USDSUI',
      gasStationKey: null,
      gasStationDailyBudgetSui,
      gasStationRateLimitPerMin,
      testMode: true,
    };
  }

  // Prod mode: every chain id is required.
  const mcpxPackageId = mustEnv(envIn, 'MCPX_PACKAGE_ID');
  const platformConfigId = mustEnv(envIn, 'MCPX_PLATFORM_CONFIG_ID');
  const treasuryId = mustEnv(envIn, 'MCPX_TREASURY_ID');
  const insuranceId = mustEnv(envIn, 'MCPX_INSURANCE_ID');
  const registryId = mustEnv(envIn, 'MCPX_REGISTRY_ID');
  const usdsuiTypeTag = mustEnv(envIn, 'USDSUI_COIN_TYPE');
  const gasStationKey = mustEnv(envIn, 'GAS_STATION_KEY');

  return {
    port,
    network,
    suiRpcUrl,
    mcpxPackageId,
    platformConfigId,
    treasuryId,
    insuranceId,
    registryId,
    usdsuiTypeTag,
    gasStationKey,
    gasStationDailyBudgetSui,
    gasStationRateLimitPerMin,
    testMode: false,
  };
}

function mustEnv(env: NodeJS.ProcessEnv, name: string): string {
  const v = env[name];
  if (!v || v.length === 0) {
    throw new Error(`required env ${name} is not set (set MCPX_FACILITATOR_TEST_MODE=1 for tests)`);
  }
  return v;
}

function parseIntOr(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} must be a positive integer`);
  return n;
}

function defaultRpcForNetwork(network: FacilitatorEnv['network']): string {
  switch (network) {
    case 'sui-mainnet':
      return 'https://fullnode.mainnet.sui.io:443';
    case 'sui-testnet':
      return 'https://fullnode.testnet.sui.io:443';
    case 'sui-devnet':
      return 'https://fullnode.devnet.sui.io:443';
  }
}
