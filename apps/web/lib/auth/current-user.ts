/**
 * Server helper: resolve the current mcpxgg user from the Privy identity
 * cookie. Used by dashboard server components / route handlers.
 */

import "server-only";
import { cookies } from "next/headers";
import { verifyPrivyToken } from "@/lib/privy/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CurrentUser {
  id: string;
  email: string;
  apiKey: string;
  suiAddress: string | null;
  migrationStatus: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const token = jar.get("privy-token")?.value ?? jar.get("privy-id-token")?.value;
  if (!token) return null;

  let identity;
  try {
    identity = await verifyPrivyToken(token);
  } catch {
    return null;
  }

  const sb = createAdminClient();
  const { data } = (await sb
    .from("users")
    .select("id, email, api_key, sui_address, migration_status")
    .eq("privy_did", identity.privyDid)
    .maybeSingle()) as {
    data: {
      id: string;
      email: string;
      api_key: string;
      sui_address: string | null;
      migration_status: string;
    } | null;
  };
  if (!data) return null;
  return {
    id: data.id,
    email: data.email,
    apiKey: data.api_key,
    suiAddress: data.sui_address,
    migrationStatus: data.migration_status,
  };
}
