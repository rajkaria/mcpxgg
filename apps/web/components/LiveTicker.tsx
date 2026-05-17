/**
 * <LiveTicker /> (S4-T18) — server component. Cumulative USDsui settled +
 * calls today, from the dashboard_usage materialized view (indexer mirror,
 * no chain RPC). Renders nothing if the mirror is empty/unreachable.
 */

import { getPlatformTotals, usdsui } from "@/lib/chain/reads";

export async function LiveTicker() {
  let totals: { cumulativeSettledAtomic: bigint; callsToday: number };
  try {
    totals = await getPlatformTotals();
  } catch {
    return null;
  }
  if (totals.cumulativeSettledAtomic === BigInt(0) && totals.callsToday === 0) {
    return null;
  }
  return (
    <div
      className="rounded-full border px-4 py-1.5 text-xs font-mono"
      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
    >
      <span style={{ color: "var(--primary)" }}>
        ${usdsui(totals.cumulativeSettledAtomic)}
      </span>{" "}
      settled · {totals.callsToday.toLocaleString()} calls today
    </div>
  );
}
