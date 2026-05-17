"use client";

/**
 * S6-T22. "Try before you enable" button. One free treasury-subsidised call
 * (rate-limited 1/user/server server-side). Result renders inline.
 */

import { useState } from "react";
import { usePrivy, getAccessToken } from "@privy-io/react-auth";

export function DemoCallButton({
  serverObjectId,
}: {
  serverObjectId: string | null;
}) {
  const { authenticated, login } = usePrivy();
  const [phase, setPhase] = useState<"idle" | "loading" | "ok" | "error">(
    "idle",
  );
  const [msg, setMsg] = useState("");

  if (!serverObjectId) return null;

  async function tryDemo() {
    if (!authenticated) {
      login();
      return;
    }
    setPhase("loading");
    setMsg("");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/demo-call", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ serverObjectId }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `demo failed (${res.status})`);
      }
      setPhase("ok");
      setMsg(data.message ?? "Demo authorized.");
    } catch (e) {
      setPhase("error");
      setMsg(e instanceof Error ? e.message : "demo error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={tryDemo}
        disabled={phase === "loading"}
        className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors hover:opacity-80"
        style={{
          borderColor: "var(--primary)",
          color: "var(--primary)",
          background: "transparent",
        }}
      >
        {phase === "loading" ? "Authorizing…" : "Try a free demo call"}
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
