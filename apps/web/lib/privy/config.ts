/**
 * Privy configuration (S4-T01). The app id is public; the app secret is
 * server-only and never imported into a client bundle.
 */

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function privyServerSecret(): string {
  const s = process.env.PRIVY_APP_SECRET;
  if (!s) throw new Error("PRIVY_APP_SECRET is not set");
  return s;
}

/** Sui network the embedded wallet operates on. */
export const SUI_NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK ??
  "sui-testnet") as "sui-mainnet" | "sui-testnet" | "sui-devnet";
