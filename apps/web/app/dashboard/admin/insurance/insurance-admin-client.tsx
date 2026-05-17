"use client";

/**
 * S7-T18. Insurance-fund top-up UI. Builds the insurance::top_up PTB
 * server-side (/api/admin/insurance, admin-gated) and the admin's Privy
 * embedded wallet signs+submits — same architecture as <IntentManager />.
 * The new pool balance appears once the indexer mirrors InsuranceCollected.
 */

import { useCallback, useEffect, useState } from "react";
import {
  usePrivy,
  useSignTransaction,
  getAccessToken,
} from "@privy-io/react-auth";

function usd(atomic: string): string {
  const a = BigInt(atomic || "0");
  const whole = a / 1_000_000n;
  const frac = (a % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `$${whole.toString()}.${frac}`;
}

type Phase = "idle" | "working" | "error" | "done";

export function InsuranceAdminClient({
  overview,
}: {
  overview: {
    balanceAtomic: string;
    lifetimeCollectedAtomic: string;
    lifetimePaidAtomic: string;
  };
}) {
  const { authenticated, login } = usePrivy();
  const { signTransaction } = useSignTransaction();

  const [amount, setAmount] = useState(100);
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const [live, setLive] = useState(overview);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/insurance", { cache: "no-store" });
      if (!r.ok) return;
      const d = (await r.json()) as typeof overview;
      setLive(d);
    } catch {
      /* keep last */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function topUp(e: React.FormEvent) {
    e.preventDefault();
    if (!authenticated) {
      login();
      return;
    }
    setPhase("working");
    setMsg("");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/admin/insurance", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amountUsd: amount }),
      });
      const data = (await res.json()) as {
        txBytesB64?: string;
        error?: string;
      };
      if (!res.ok || !data.txBytesB64) {
        throw new Error(data.error ?? `top-up failed (${res.status})`);
      }
      await signTransaction({
        transaction: data.txBytesB64,
        chain: "sui",
      } as unknown as Parameters<typeof signTransaction>[0]);
      setPhase("done");
      setMsg(
        "Top-up submitted. The new balance appears here once indexed.",
      );
      setTimeout(() => void refresh(), 4000);
    } catch (err) {
      setPhase("error");
      setMsg(err instanceof Error ? err.message : "top-up error");
    }
  }

  const busy = phase === "working";
  const stats = [
    { label: "Pool balance", value: usd(live.balanceAtomic) },
    { label: "Lifetime collected", value: usd(live.lifetimeCollectedAtomic) },
    { label: "Lifetime paid", value: usd(live.lifetimePaidAtomic) },
  ];

  return (
    <div className="space-y-6">
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
            <p className="mt-1 text-2xl font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <form
        onSubmit={topUp}
        className="rounded-xl border p-5 space-y-4"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h2 className="font-semibold">Top up from sponsor donation</h2>
        <div>
          <label className="text-sm font-medium">Amount (USD)</label>
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="input mt-1 w-full"
          />
        </div>
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "Confirm in wallet…" : "Top up pool"}
        </button>
        {msg && (
          <p
            className={`text-xs ${phase === "error" ? "text-red-400" : "text-emerald-400"}`}
          >
            {msg}
          </p>
        )}
      </form>
    </div>
  );
}
