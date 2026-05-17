/**
 * /receipts/[id] (S4-T10). Resolves the CallReceipt from the request_log
 * mirror, then fetches the archived request/response blob from Walrus. If
 * the blob is a Seal envelope, hands off to <SealReceiptViewer /> (S4-T11).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveChain } from "@mcpxgg/chain";
import { createWalrusClient, walrusEnv, type SealEnvelope } from "@mcpxgg/walrus";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getReceipt, usdsui } from "@/lib/chain/reads";
import { SealReceiptViewer } from "@/components/SealReceiptViewer";

function isSealEnvelope(v: unknown): v is SealEnvelope {
  return (
    typeof v === "object" &&
    v !== null &&
    "scheme" in v &&
    typeof (v as { scheme: unknown }).scheme === "string" &&
    "payloadB64" in v
  );
}

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return <p className="p-6 text-sm">Sign in to view this receipt.</p>;

  const receipt = await getReceipt(user.id, id);
  if (!receipt) notFound();

  const chain = getActiveChain();
  let payload: unknown = null;
  let sealed: SealEnvelope | null = null;
  let blobError: string | null = null;

  if (receipt.receiptBlobId) {
    try {
      const walrus = createWalrusClient(walrusEnv());
      const json = await walrus.retrieveJSON(receipt.receiptBlobId);
      if (isSealEnvelope(json)) sealed = json;
      else payload = json;
    } catch (e) {
      blobError = e instanceof Error ? e.message : "blob unavailable";
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link href="/dashboard/usage" className="text-sm underline opacity-70">
        ← back to usage
      </Link>
      <h1 className="mt-2 text-xl font-semibold">
        {receipt.namespace}_{receipt.toolName}
      </h1>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <span>Status: {receipt.status}</span>
        <span>Amount: {usdsui(receipt.amountAtomic)} USDsui</span>
        <span>When: {new Date(receipt.createdAt).toLocaleString()}</span>
        {receipt.txDigest && (
          <a
            className="underline"
            href={chain.txExplorerUrl(receipt.txDigest)}
            target="_blank"
            rel="noreferrer"
          >
            View settlement on suiscan ↗
          </a>
        )}
      </div>
      {receipt.receiptObjectId && (
        <code className="mt-2 block text-[10px] opacity-50">
          receipt object: {receipt.receiptObjectId}
        </code>
      )}

      <h2 className="mt-6 mb-2 text-sm font-semibold">Archived payload</h2>
      {blobError && (
        <p className="text-xs text-red-400">Walrus: {blobError}</p>
      )}
      {sealed && <SealReceiptViewer envelope={sealed} />}
      {payload !== null && (
        <pre className="overflow-x-auto rounded bg-black/30 p-3 text-xs">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
      {!sealed && payload === null && !blobError && (
        <p className="text-xs opacity-60">No payload archived for this call.</p>
      )}
    </div>
  );
}
