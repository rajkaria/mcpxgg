import { ImageResponse } from "next/og";
import { getLiveMetrics } from "@/lib/chain/reads";

/**
 * S6-T17. Dynamic OG image — every social embed regenerates with the current
 * cumulative 24h numbers so a shared /live link shows live stats.
 */

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

function usd(atomic: bigint): string {
  const whole = atomic / 1_000_000n;
  return `$${whole.toLocaleString()}`;
}

export default async function OgImage() {
  let calls = 0;
  let settled = 0n;
  let servers = 0;
  let users = 0;
  try {
    const m = await getLiveMetrics();
    calls = m.totalCalls;
    settled = m.totalSettledAtomic;
    servers = m.activeServers;
    users = m.activeUsers;
  } catch {
    /* render zeros if mirror is unavailable */
  }

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "28px 36px",
        border: "1px solid #2a2a3a",
        borderRadius: 18,
        background: "#12121c",
      }}
    >
      <div style={{ fontSize: 22, color: "#8a8aa0", letterSpacing: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 56, fontWeight: 800, color: "#fff" }}>
        {value}
      </div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "#0a0a12",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: "#fff" }}>
            MCPX
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#7c5cff",
              textTransform: "uppercase",
              letterSpacing: 4,
            }}
          >
            Live · 24h
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
          }}
        >
          <Stat label="CALLS" value={calls.toLocaleString()} />
          <Stat label="SETTLED" value={usd(settled)} />
          <Stat label="ACTIVE SERVERS" value={servers.toLocaleString()} />
          <Stat label="ACTIVE USERS" value={users.toLocaleString()} />
        </div>
        <div style={{ fontSize: 24, color: "#8a8aa0" }}>
          Every settled MCP call, on-chain, as it happens.
        </div>
      </div>
    ),
    { ...size },
  );
}
