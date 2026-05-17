import { ImageResponse } from "next/og";
import { getPlatformTotals, usdsui } from "@/lib/chain/reads";

/**
 * S8-T16. Root OG/Twitter card with the live cumulative-settled number, so
 * a shared mcpx.gg link shows real on-chain volume. Degrades to the static
 * pitch when the mirror is unavailable.
 */

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";
export const alt =
  "MCPX — the on-chain MCP marketplace, settled in USDsui on Sui";

export default async function OgImage() {
  let settled = "0.00";
  let calls = 0;
  try {
    const t = await getPlatformTotals();
    settled = usdsui(t.cumulativeSettledAtomic);
    calls = t.callsToday;
  } catch {
    /* static fallback */
  }
  const hasLive = settled !== "0.00" || calls > 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#050507",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 44, fontWeight: 800, color: "#fff" }}>
            MCPX
          </div>
          <div
            style={{
              fontSize: 22,
              color: "#818cf8",
              textTransform: "uppercase",
              letterSpacing: 4,
            }}
          >
            Sui · x402 · USDsui
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: "#fff",
              lineHeight: 1.05,
              maxWidth: 900,
            }}
          >
            The on-chain MCP marketplace, settled in USDsui.
          </div>
          <div style={{ fontSize: 28, color: "#94a3b8", maxWidth: 820 }}>
            One API key for every MCP server. Every tool call settles on Sui.
            Permanent receipts. Developers earn straight to a vault.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          {hasLive ? (
            <>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 20, color: "#64748b", letterSpacing: 3 }}>
                  CUMULATIVE SETTLED
                </div>
                <div style={{ fontSize: 44, fontWeight: 800, color: "#34d399" }}>
                  ${settled} USDsui
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 20, color: "#64748b", letterSpacing: 3 }}>
                  CALLS TODAY
                </div>
                <div style={{ fontSize: 44, fontWeight: 800, color: "#fff" }}>
                  {calls.toLocaleString()}
                </div>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 24, color: "#64748b" }}>
              No subscriptions. No credits. Pay per call in USDsui.
            </div>
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
