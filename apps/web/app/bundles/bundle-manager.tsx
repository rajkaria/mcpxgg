"use client";

/**
 * <BundleManager /> (S5-T18). One "Enable bundle" button per curated bundle.
 * Click → server builds the activate PTB (mcpx::bundle::activate_for_user)
 * → Privy embedded wallet signs+submits → the indexer mirrors
 * BundleActivated. Mirrors <RechargeFlow />'s wallet-signing seam exactly
 * (same usePrivy/useSignTransaction/getAccessToken, optimistic UI, error
 * toast). Degrades to a static "connect wallet" CTA when Privy is unset,
 * exactly like the rest of the app (providers.tsx renders children unwrapped
 * without NEXT_PUBLIC_PRIVY_APP_ID, so the Privy hooks must not run then).
 */

import { useState } from "react";
import { usePrivy, useSignTransaction, getAccessToken } from "@privy-io/react-auth";
import { PRIVY_APP_ID } from "@/lib/privy/config";

export interface BundleManagerItem {
  /** Indexer-mirrored bundle object id, or null if not yet on-chain. */
  bundleObjectId: string | null;
  name: string;
}

type Phase = "idle" | "preparing" | "signing" | "done" | "error";

function EnableButton({ item }: { item: BundleManagerItem }) {
  const { authenticated, login } = usePrivy();
  const { signTransaction } = useSignTransaction();
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState<string>("");

  if (!authenticated) {
    return (
      <button
        className="px-4 py-2 rounded-xl text-sm font-medium w-full"
        style={{ background: "var(--primary)", color: "#fff" }}
        onClick={() => login()}
      >
        Connect wallet to enable
      </button>
    );
  }

  if (!item.bundleObjectId) {
    return (
      <button
        className="px-4 py-2 rounded-xl text-sm font-medium w-full opacity-60 cursor-not-allowed border"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        disabled
        title="On-chain seeding is gated on the S5-T22 mainnet deploy"
      >
        Coming at mainnet launch
      </button>
    );
  }

  async function enable() {
    const id = item.bundleObjectId;
    if (!id) return;
    setPhase("preparing");
    setMsg("");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/bundles/activate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bundleObjectId: id }),
      });
      const data = (await res.json()) as {
        txBytesB64?: string;
        error?: string;
      };
      if (!res.ok || !data.txBytesB64) {
        throw new Error(data.error ?? `enable failed (${res.status})`);
      }
      setPhase("signing");
      await signTransaction({
        transaction: data.txBytesB64,
        chain: "sui",
      } as unknown as Parameters<typeof signTransaction>[0]);
      setPhase("done");
      setMsg("Bundle enabled. Servers activate in a few seconds.");
    } catch (e) {
      setPhase("error");
      setMsg(e instanceof Error ? e.message : "enable error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        className="px-4 py-2 rounded-xl text-sm font-medium w-full"
        style={{ background: "var(--primary)", color: "#fff" }}
        disabled={phase === "preparing" || phase === "signing" || phase === "done"}
        onClick={enable}
      >
        {phase === "preparing"
          ? "Preparing…"
          : phase === "signing"
            ? "Confirm in wallet…"
            : phase === "done"
              ? "Enabled ✓"
              : "Enable bundle"}
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

export function BundleManager({ item }: { item: BundleManagerItem }) {
  // Privy provider is absent without NEXT_PUBLIC_PRIVY_APP_ID — calling the
  // Privy hooks would throw, so render a static CTA instead (degrade path).
  if (!PRIVY_APP_ID) {
    return (
      <button
        className="px-4 py-2 rounded-xl text-sm font-medium w-full opacity-70 cursor-not-allowed border"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        disabled
        title="Set NEXT_PUBLIC_PRIVY_APP_ID to enable wallet sign-in"
      >
        Connect wallet (sign-in unavailable)
      </button>
    );
  }
  return <EnableButton item={item} />;
}
