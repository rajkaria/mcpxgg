"use client";

/**
 * <RechargeFlow /> (S4-T06/T07). Connect → enter USD → server builds the
 * Session PTB → Privy embedded wallet signs+submits → balance updates once
 * the indexer mirrors SessionCreated/SessionDeposit.
 */

import { useState } from "react";
import { usePrivy, useSignTransaction, getAccessToken } from "@privy-io/react-auth";

type Phase = "idle" | "quoting" | "signing" | "done" | "error";

export function RechargeFlow() {
  const { authenticated, login } = usePrivy();
  const { signTransaction } = useSignTransaction();
  const [usd, setUsd] = useState(5);
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState<string>("");

  async function recharge() {
    setPhase("quoting");
    setMsg("");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/session/recharge", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ usdAmount: usd }),
      });
      const data = (await res.json()) as {
        txBytesB64?: string;
        kind?: string;
        error?: string;
      };
      if (!res.ok || !data.txBytesB64) {
        throw new Error(data.error ?? `recharge failed (${res.status})`);
      }
      setPhase("signing");
      // Privy embedded Sui wallet signs the BCS tx bytes the server built.
      await signTransaction({
        transaction: data.txBytesB64,
        chain: "sui",
      } as unknown as Parameters<typeof signTransaction>[0]);
      setPhase("done");
      setMsg(
        data.kind === "create_session"
          ? "Session created and funded. Balance updates in a few seconds."
          : "Deposit submitted. Balance updates in a few seconds.",
      );
    } catch (e) {
      setPhase("error");
      setMsg(e instanceof Error ? e.message : "recharge error");
    }
  }

  if (!authenticated) {
    return (
      <button className="btn btn-primary" onClick={() => login()}>
        Sign in to recharge
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 max-w-sm">
      <label className="text-sm">Amount (USD)</label>
      <input
        type="number"
        min={1}
        step={1}
        value={usd}
        onChange={(e) => setUsd(Number(e.target.value))}
        className="input"
      />
      <p className="text-xs opacity-70">
        ≈ {(usd).toLocaleString()} USDsui ({usd * 1_000_000} atomic)
      </p>
      <button
        className="btn btn-primary"
        disabled={phase === "quoting" || phase === "signing"}
        onClick={recharge}
      >
        {phase === "quoting"
          ? "Preparing…"
          : phase === "signing"
            ? "Confirm in wallet…"
            : "Recharge"}
      </button>
      {msg && (
        <p
          className={`text-xs ${phase === "error" ? "text-red-400" : "text-emerald-400"}`}
        >
          {msg}
        </p>
      )}
    </div>
  );
}
