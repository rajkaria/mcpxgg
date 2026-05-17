import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * S6-T25. Featured-rotation CRUD. `featured_servers` is APP-OWNED (migration
 * 012) — NOT an indexer mirror — so the app legitimately writes it via the
 * service role. Admin-gated by the ADMIN_EMAILS allowlist.
 */

function isoWeekStart(d = new Date()): string {
  const day = d.getUTCDay(); // 0 = Sun
  const diff = (day === 0 ? -6 : 1) - day; // back to Monday
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sb = createAdminClient();
  const { data } = (await sb
    .from("featured_servers")
    .select("id, server_object_id, week_start, position, created_by, created_at")
    .order("week_start", { ascending: false })
    .order("position", { ascending: true })) as {
    data: Array<Record<string, unknown>> | null;
  };
  return NextResponse.json({ featured: data ?? [], weekStart: isoWeekStart() });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    serverObjectId?: string;
    position?: number;
    weekStart?: string;
  };
  if (!body.serverObjectId) {
    return NextResponse.json(
      { error: "serverObjectId required" },
      { status: 400 },
    );
  }
  const weekStart = body.weekStart ?? isoWeekStart();

  const sb = createAdminClient();
  const { error } = await sb.from("featured_servers").upsert(
    {
      server_object_id: body.serverObjectId,
      week_start: weekStart,
      position: body.position ?? 0,
      created_by: admin.email,
    },
    { onConflict: "week_start,server_object_id" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    serverObjectId?: string;
    weekStart?: string;
  };
  if (!body.serverObjectId) {
    return NextResponse.json(
      { error: "serverObjectId required" },
      { status: 400 },
    );
  }
  const sb = createAdminClient();
  const { error } = await sb
    .from("featured_servers")
    .delete()
    .eq("server_object_id", body.serverObjectId)
    .eq("week_start", body.weekStart ?? isoWeekStart());
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
