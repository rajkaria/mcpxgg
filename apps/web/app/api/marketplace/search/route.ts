import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const category = url.searchParams.get("category") || "";
  const sort = url.searchParams.get("sort") || "popular";
  const page = parseInt(url.searchParams.get("page") || "0", 10);
  const pageSize = 12;

  const supabase = createAdminClient();

  let query = supabase
    .from("mcp_servers")
    .select("id, namespace, name, description, category, tags, icon_url, total_users, avg_rating, is_featured, created_at", { count: "exact" })
    .eq("status", "active");

  if (q) {
    const pattern = `%${q}%`;
    query = query.or(
      `name.ilike.${pattern},description.ilike.${pattern},namespace.ilike.${pattern}`
    );
  }

  if (category && category !== "All") {
    query = query.eq("category", category);
  }

  switch (sort) {
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "rating":
      query = query.order("avg_rating", { ascending: false });
      break;
    case "popular":
    default:
      query = query
        .order("is_featured", { ascending: false })
        .order("total_users", { ascending: false });
      break;
  }

  query = query.range(page * pageSize, (page + 1) * pageSize - 1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, count, error } = await query as any;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    servers: data || [],
    total: count || 0,
    page,
    pageSize,
    hasMore: (data || []).length === pageSize,
  });
}
