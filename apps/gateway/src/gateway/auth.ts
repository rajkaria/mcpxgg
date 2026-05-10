import { createAdminClient } from "@/lib/supabase/admin";
import { cacheGet, cacheSet } from "@/lib/cache/upstash";

export interface AuthResult {
  userId: string;
  plan: string;
  phoneVerified: boolean;
  creditBalance: number;
  email: string;
}

const API_KEY_CACHE_TTL = 60; // seconds

export async function authenticateApiKey(apiKey: string): Promise<AuthResult> {
  if (!apiKey) {
    throw new AuthError("Missing API key", "auth_required");
  }

  // Check Upstash cache first
  const cacheKey = `apikey:${apiKey}`;
  const cached = await cacheGet<AuthResult>(cacheKey);
  if (cached) {
    return cached;
  }

  // Fall back to Supabase query
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, email, plan, phone_verified, credit_balance")
    .eq("api_key", apiKey)
    .single() as any;

  if (error || !data) {
    throw new AuthError("Invalid API key", "invalid_api_key");
  }

  const result: AuthResult = {
    userId: data.id,
    plan: data.plan || "free",
    phoneVerified: data.phone_verified || false,
    creditBalance: data.credit_balance || 0,
    email: data.email || "",
  };

  // Cache the result
  await cacheSet(cacheKey, result, API_KEY_CACHE_TTL);

  return result;
}

export class AuthError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}
