/**
 * Server-side Privy verification (S4-T03). Validates the access token the
 * client sends, and reads the linked Sui wallet + email. The Privy app
 * secret stays server-only.
 */

import "server-only";
import { PrivyClient } from "@privy-io/server-auth";
import { PRIVY_APP_ID, privyServerSecret } from "./config";

let client: PrivyClient | null = null;
function privy(): PrivyClient {
  if (!client) client = new PrivyClient(PRIVY_APP_ID, privyServerSecret());
  return client;
}

export interface PrivyIdentity {
  privyDid: string;
  email: string | null;
  /** Sui address from the user's embedded or linked wallet. */
  suiAddress: string | null;
}

export async function verifyPrivyToken(accessToken: string): Promise<PrivyIdentity> {
  const claims = await privy().verifyAuthToken(accessToken);
  const user = await privy().getUser(claims.userId);

  let email: string | null = null;
  let suiAddress: string | null = null;
  for (const acct of user.linkedAccounts) {
    if (acct.type === "email" && "address" in acct) {
      email = (acct as { address: string }).address;
    }
    if (acct.type === "wallet" && "address" in acct) {
      const w = acct as { address: string; chainType?: string };
      if (w.chainType === "sui" || w.address.startsWith("0x")) {
        suiAddress = w.address;
      }
    }
  }
  return { privyDid: claims.userId, email, suiAddress };
}
