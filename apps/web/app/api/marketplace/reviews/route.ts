import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const serverId = url.searchParams.get("server_id");

  if (!serverId) {
    return NextResponse.json({ error: "server_id is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, review_text, created_at, user_id, users(email, display_name)")
    .eq("server_id", serverId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reviews: data || [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await req.json();
  const { server_id, rating, review_text } = body;

  if (!server_id || !rating || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "server_id and rating (1-5) are required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Upsert review (one per user per server)
  const { error: upsertError } = await admin
    .from("reviews")
    .upsert(
      {
        user_id: user.id,
        server_id,
        rating,
        review_text: review_text || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,server_id" }
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // Recalculate average rating
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: avgData } = await admin
    .from("reviews")
    .select("rating")
    .eq("server_id", server_id) as any;

  if (avgData && avgData.length > 0) {
    const avg = avgData.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / avgData.length;
    await admin
      .from("mcp_servers")
      .update({ avg_rating: Math.round(avg * 10) / 10 })
      .eq("id", server_id);
  }

  return NextResponse.json({ success: true });
}
