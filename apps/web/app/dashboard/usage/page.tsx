/**
 * /dashboard/usage (S4-T09) — chain-backed. One row per CallReceipt with a
 * suiscan link (tx_digest) and a Walrus link (receipt_blob_id). Reads the
 * request_log mirror; no chain RPC. CSV export at S4-T17.
 */

import Link from "next/link";
import { getActiveChain } from "@mcpxgg/chain";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listReceipts, usdsui } from "@/lib/chain/reads";
import { SessionBalance } from "@/components/SessionBalance";
import { RechargeFlow } from "@/components/RechargeFlow";
import { ClaimRefundButton } from "@/components/ClaimRefundButton";

const WALRUS_AGG =
  process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL ??
  "https://aggregator.walrus-testnet.walrus.space";

export const metadata = { title: "Usage | MCPX" };

export default async function UsagePage() {
  const user = await getCurrentUser();
  if (!user) {
    return <p className="text-sm">Sign in to view usage.</p>;
  }
  const receipts = await listReceipts(user.id);
  const chain = getActiveChain();

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <SessionBalance />
        <div className="rounded-lg border border-[var(--border)] p-4">
          <h2 className="mb-2 text-sm font-semibold">Recharge</h2>
          <RechargeFlow />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Call receipts</h1>
        <a className="btn btn-ghost text-sm" href="/api/dashboard/usage/export">
          Export CSV
        </a>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="text-left opacity-60">
            <tr>
              <th className="p-2">When</th>
              <th className="p-2">Tool</th>
              <th className="p-2">Status</th>
              <th className="p-2">Amount</th>
              <th className="p-2">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {receipts.length === 0 && (
              <tr>
                <td className="p-3 opacity-60" colSpan={5}>
                  No calls yet. Recharge and call a server through the gateway.
                </td>
              </tr>
            )}
            {receipts.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border)]">
                <td className="p-2">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="p-2 font-mono">
                  {r.namespace}_{r.toolName}
                </td>
                <td className="p-2">
                  {r.status}
                  {r.refunded && (
                    <span className="ml-1 text-xs text-emerald-400">
                      (refunded {usdsui(r.refundAmountAtomic)})
                    </span>
                  )}
                </td>
                <td className="p-2">{usdsui(r.amountAtomic)} USDsui</td>
                <td className="p-2 flex gap-2">
                  <Link className="underline" href={`/receipts/${r.id}`}>
                    view
                  </Link>
                  {r.txDigest && (
                    <a
                      className="underline opacity-70"
                      href={chain.txExplorerUrl(r.txDigest)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      tx
                    </a>
                  )}
                  {r.receiptBlobId && (
                    <a
                      className="underline opacity-70"
                      href={`${WALRUS_AGG}/v1/blobs/${r.receiptBlobId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      blob
                    </a>
                  )}
                  {r.claimable && r.receiptObjectId && (
                    <ClaimRefundButton receiptId={r.id} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
