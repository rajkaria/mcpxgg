/**
 * /insurance (S7-T16). Public insurance-pool transparency dashboard: live
 * pool balance, all-time payouts, lifetime collected, recent payouts, and
 * the top contributors. Reads the Supabase indexer mirror only (ADR-011) —
 * `platform_state` + the `insurance_payouts` / `insurance_top_contributors`
 * mirrors (migration 016). The indexer that fills them is another workstream;
 * see the TODO(indexer) markers in lib/chain/reads.ts.
 */

import Link from "next/link";
import {
  getInsuranceOverview,
  listInsurancePayouts,
  listInsuranceTopContributors,
  usdsui,
  type InsuranceOverview,
  type InsurancePayoutRow,
  type InsuranceContributorRow,
} from "@/lib/chain/reads";

export const metadata = {
  title: "Insurance Pool | MCPX",
  description:
    "The MCPX insurance pool, fully transparent: balance, payouts to failed calls, and every contributor — all settled on-chain.",
};

export const dynamic = "force-dynamic";

function shortAddr(a: string | null): string {
  if (!a) return "—";
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function whenMs(ms: number): string {
  return ms > 0 ? new Date(ms).toLocaleString() : "—";
}

export default async function InsurancePage() {
  let overview: InsuranceOverview = {
    balanceAtomic: 0n,
    lifetimeCollectedAtomic: 0n,
    lifetimePaidAtomic: 0n,
    poolObjectId: null,
  };
  let payouts: InsurancePayoutRow[] = [];
  let contributors: InsuranceContributorRow[] = [];
  try {
    [overview, payouts, contributors] = await Promise.all([
      getInsuranceOverview(),
      listInsurancePayouts(25),
      listInsuranceTopContributors(15),
    ]);
  } catch {
    // Mirror unavailable (no Supabase env in local dev) — render zeros.
  }

  const stats = [
    { label: "Pool balance", value: usdsui(overview.balanceAtomic) },
    {
      label: "Total payouts to date",
      value: usdsui(overview.lifetimePaidAtomic),
    },
    {
      label: "Lifetime collected",
      value: usdsui(overview.lifetimeCollectedAtomic),
    },
  ];

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Insurance Pool</h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          A slice of every settled call funds an on-chain pool that refunds
          failed tool calls. Fully transparent — every figure here is a mirror
          of Sui chain state.
        </p>
        {overview.poolObjectId && (
          <code className="mt-2 block text-[10px] opacity-50">
            pool object: {overview.poolObjectId}
          </code>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border p-5"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <p className="text-xs uppercase opacity-60">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold">
              {s.value}{" "}
              <span className="text-sm font-normal opacity-60">USDsui</span>
            </p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Recent payouts</h2>
        {payouts.length === 0 ? (
          <p className="text-sm opacity-60">
            No payouts yet. Failed calls reclaimed from the pool appear here.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="text-left opacity-60">
                <tr>
                  <th className="p-2">When</th>
                  <th className="p-2">Payee</th>
                  <th className="p-2">Refund</th>
                  <th className="p-2">Tx</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr
                    key={p.originalReceiptId}
                    className="border-t border-[var(--border)]"
                  >
                    <td className="p-2">{whenMs(p.timestampMs)}</td>
                    <td className="p-2 font-mono">
                      {shortAddr(p.payeeAddress)}
                    </td>
                    <td className="p-2">
                      {usdsui(p.refundAmountAtomic)} USDsui
                    </td>
                    <td className="p-2 font-mono opacity-60">
                      {shortAddr(p.txDigest)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Top contributors</h2>
        {contributors.length === 0 ? (
          <p className="text-sm opacity-60">No contributions yet.</p>
        ) : (
          <div className="space-y-2">
            {contributors.map((c, i) => (
              <div
                key={c.contributorAddress}
                className="flex items-center justify-between rounded-lg border px-4 py-2 text-sm"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                <span className="font-mono">
                  <span className="mr-3 opacity-50">#{i + 1}</span>
                  {shortAddr(c.contributorAddress)}
                </span>
                <span>
                  {usdsui(c.totalAtomic)} USDsui
                  <span className="ml-3 opacity-60">
                    {c.contributionCount} contribution
                    {c.contributionCount === 1 ? "" : "s"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="mt-8 text-xs opacity-60">
        Failed a call?{" "}
        <Link href="/dashboard/usage" className="underline">
          Claim a refund from your usage page
        </Link>
        .
      </p>
    </main>
  );
}
