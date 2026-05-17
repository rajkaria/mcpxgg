/**
 * Sui on-chain config for session PTBs (S4-T06/T07). Server-only — these
 * env vars come from the testnet/mainnet deploy (S1-T17 / S5-T22).
 */

import "server-only";
import type { SuiTxConfig } from "@mcpxgg/chain";

const RPC: Record<string, string> = {
  "sui-mainnet": "https://fullnode.mainnet.sui.io:443",
  "sui-testnet": "https://fullnode.testnet.sui.io:443",
  "sui-devnet": "https://fullnode.devnet.sui.io:443",
};

export function suiTxConfig(): SuiTxConfig {
  const network = process.env.NEXT_PUBLIC_SUI_NETWORK ?? "sui-testnet";
  const packageId = process.env.MCPX_PACKAGE_ID;
  const sessionRegistryId = process.env.MCPX_REGISTRY_ID;
  const coinType = process.env.USDSUI_COIN_TYPE;
  if (!packageId || !sessionRegistryId || !coinType) {
    throw new Error(
      "Sui not configured: set MCPX_PACKAGE_ID, MCPX_REGISTRY_ID, USDSUI_COIN_TYPE (after S1-T17 deploy)",
    );
  }
  return {
    packageId,
    sessionRegistryId,
    coinType,
    rpcUrl: process.env.SUI_RPC_URL ?? RPC[network] ?? RPC["sui-testnet"]!,
  };
}

/** USD → USDsui atomic (6 decimals). USDsui is a USD stablecoin → 1:1,
 *  overridable by an oracle later. */
export function usdToUsdsuiAtomic(usd: number): bigint {
  if (!Number.isFinite(usd) || usd <= 0) throw new Error("amount must be > 0");
  return BigInt(Math.round(usd * 1_000_000));
}
