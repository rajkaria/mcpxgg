import { NextResponse } from "next/server";
import { getLiveMetrics } from "@/lib/chain/reads";

/**
 * S6-T16. Cumulative 24h metrics for the /live page, derived from the
 * `live_feed_24h` materialized view (migration 007). Polled by the client.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const m = await getLiveMetrics();
    return NextResponse.json({
      totalCalls: m.totalCalls,
      totalSettledAtomic: m.totalSettledAtomic.toString(),
      activeServers: m.activeServers,
      activeUsers: m.activeUsers,
      topServers: m.topServers,
      activeUserList: m.activeUserList,
    });
  } catch {
    return NextResponse.json({
      totalCalls: 0,
      totalSettledAtomic: "0",
      activeServers: 0,
      activeUsers: 0,
      topServers: [],
      activeUserList: [],
    });
  }
}
