"use client";

/**
 * <ClaimRefundButton /> (S7-T15). Shown on a failed, not-yet-refunded
 * CallReceipt. Builds the claim_for_failed_call PTB server-side
 * (/api/receipts/claim-refund) and the payer's Privy embedded wallet
 * signs+submits — identical architecture to <IntentManager />. The web never
 * writes the request_log mirror; the row flips to refunded once the indexer
 * mirrors the RefundIssued event.
 */

import { useState } from "react";
import {
  usePrivy,
  useSignTransaction,
  getAccessToken,
} from "@privy-io/react-auth";

type Phase = "idle" | "working" | "error" | "done";

export function ClaimRefundButton({
  receiptId,
  className,
}: {
  receiptId: string;
  className?: string;
}) {
  const { authenticated, login } = usePrivy();
  const { signTransaction } = useSignTransaction();
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");

  async function claim() {
    if (!authenticated) {
      login();
      return;
    }
    setPhase("working");
    setMsg("");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/receipts/claim-refund", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ receiptId }),
      });
      const data = (await res.json()) as {
        txBytesB64?: string;
        error?: string;
      };
      if (!res.ok || !data.txBytesB64) {
        throw new Error(data.error ?? `claim failed (${res.status})`);
      }
      await signTransaction({
        transaction: data.txBytesB64,
        chain: "sui",
      } as unknown as Parameters<typeof signTransaction>[0]);
      setPhase("done");
      setMsg("Refund claimed. It clears here once indexed.");
    } catch (err) {
      setPhase("error");
      setMsg(err instanceof Error ? err.message : "claim error");
    }
  }

  const busy = phase === "working";

  if (phase === "done") {
    return (
      <span className={`text-xs text-emerald-400 ${className ?? ""}`}>
        {msg}
      </span>
    );
  }

  return (
    <span className={className}>
      <button
        onClick={claim}
        disabled={busy}
        className="btn btn-primary text-xs"
        title="Reclaim this failed call's cost from the insurance pool"
      >
        {busy ? "Confirm in wallet…" : "Claim refund"}
      </button>
      {phase === "error" && (
        <span className="ml-2 text-xs text-red-400">{msg}</span>
      )}
    </span>
  );
}
