"use client";

/**
 * S6-T23. In-app low-balance banner. Polls /api/alerts/low-balance (which
 * also fires the one-time email). Renders nothing until a low balance is
 * detected; dismissible for the session.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

export function LowBalanceBanner() {
  const [low, setLow] = useState(false);
  const [balanceUsd, setBalanceUsd] = useState("0.00");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const r = await fetch("/api/alerts/low-balance", {
          cache: "no-store",
        });
        if (!r.ok) return;
        const d = (await r.json()) as { low?: boolean; balanceUsd?: string };
        if (!alive) return;
        setLow(Boolean(d.low));
        if (d.balanceUsd) setBalanceUsd(d.balanceUsd);
      } catch {
        /* ignore */
      }
    };
    void check();
    const iv = setInterval(check, 60000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  if (!low || dismissed) return null;

  return (
    <div
      className="mb-4 flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm"
      style={{
        background: "var(--surface)",
        borderColor: "var(--warning)",
        color: "var(--text)",
      }}
    >
      <span>
        Your session balance is low (${balanceUsd} USDsui). Recharge to keep
        tool calls running.
      </span>
      <div className="flex items-center gap-3 shrink-0">
        <Link
          href="/dashboard/billing"
          className="font-medium underline"
          style={{ color: "var(--primary)" }}
        >
          Recharge
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="opacity-60 hover:opacity-100"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
