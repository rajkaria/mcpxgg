import { NextResponse } from "next/server";

/**
 * S8-T10. Liveness endpoint for the web app itself. Intentionally trivial —
 * no DB, no chain — so the status page's self-probe reflects "is the Next
 * server answering" and nothing heavier.
 */

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, service: "web", ts: Date.now() });
}
