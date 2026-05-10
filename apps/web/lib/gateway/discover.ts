import { createAdminClient } from "@/lib/supabase/admin";
import { debitCredits } from "@/lib/billing/credits";
import { GatewayError } from "@/lib/gateway/errors";

const FREE_DISCOVERS_PER_WEEK = 10;
const DISCOVER_CREDIT_COST = 1;
const MAX_RESULTS = 10;

export interface DiscoverResult {
  servers: Array<{
    namespace: string;
    name: string;
    description: string;
    category: string | null;
    tags: string[];
    icon_url: string | null;
    total_users: number;
    avg_rating: number;
    is_featured: boolean;
  }>;
  total: number;
  credits_charged: number;
  free_remaining: number;
}

/**
 * Searches the mcp_servers marketplace using ILIKE matching on
 * name, description, tags, and trigger_phrases.
 *
 * Rate limited: 10 free searches per week, then 1 credit per search.
 */
export async function discover(
  userId: string,
  query: string,
  creditBalance: number
): Promise<DiscoverResult> {
  if (!query || query.trim().length === 0) {
    throw new GatewayError("Search query is required", "invalid_request");
  }

  const supabase = createAdminClient();
  const trimmedQuery = query.trim();

  // Check weekly usage
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { count: weeklyUsage } = await supabase
    .from("discover_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", weekAgo.toISOString()) as any;

  const usageCount = weeklyUsage || 0;
  const freeRemaining = Math.max(0, FREE_DISCOVERS_PER_WEEK - usageCount);
  let creditsCharged = 0;

  // If free quota exhausted, charge 1 credit
  if (freeRemaining === 0) {
    if (creditBalance < DISCOVER_CREDIT_COST) {
      throw new GatewayError(
        `Free discover limit reached (${FREE_DISCOVERS_PER_WEEK}/week). You need ${DISCOVER_CREDIT_COST} credit to search. Current balance: ${creditBalance}.`,
        "insufficient_credits"
      );
    }
    await debitCredits({ userId, amount: DISCOVER_CREDIT_COST, description: "mcpx_discover search" });
    creditsCharged = DISCOVER_CREDIT_COST;
  }

  // Search using ILIKE on multiple columns
  const pattern = `%${trimmedQuery}%`;

  const { data, error } = await supabase
    .from("mcp_servers")
    .select(
      "namespace, name, description, category, tags, icon_url, total_users, avg_rating, is_featured"
    )
    .eq("status", "active")
    .or(
      `name.ilike.${pattern},description.ilike.${pattern},tags.cs.{${trimmedQuery}},trigger_phrases.cs.{${trimmedQuery}}`
    )
    .order("is_featured", { ascending: false })
    .order("total_users", { ascending: false })
    .limit(MAX_RESULTS) as any;

  const servers = (data || []) as DiscoverResult["servers"];

  // Log usage
  await supabase.from("discover_usage").insert({
    user_id: userId,
    query: trimmedQuery,
    results_count: servers.length,
    credited: creditsCharged > 0,
  } as any);

  return {
    servers,
    total: servers.length,
    credits_charged: creditsCharged,
    free_remaining: Math.max(0, freeRemaining - 1),
  };
}
