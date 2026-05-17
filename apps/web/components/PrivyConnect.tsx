"use client";

/**
 * <PrivyConnect /> (S4-T02) — replaces the Supabase email/password login UI.
 * On login it exchanges the Privy access token for the user's mcpxgg API
 * key + bound Sui address (S4-T05) via /api/auth/session.
 */

import { useEffect, useState } from "react";
import { usePrivy, getAccessToken } from "@privy-io/react-auth";

interface BoundAccount {
  apiKey: string;
  suiAddress: string | null;
  migrationStatus: string;
}

export function PrivyConnect() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const [account, setAccount] = useState<BoundAccount | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) {
      setAccount(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`bind failed (${res.status})`);
        const data = (await res.json()) as BoundAccount;
        if (!cancelled) setAccount(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "bind error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated]);

  if (!ready) return <button className="btn" disabled>Loading…</button>;

  if (!authenticated) {
    return (
      <button className="btn btn-primary" onClick={() => login()}>
        Sign in
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-mono">
          {account?.suiAddress
            ? `${account.suiAddress.slice(0, 6)}…${account.suiAddress.slice(-4)}`
            : (user?.email?.address ?? "connected")}
        </span>
        <button className="btn btn-ghost" onClick={() => logout()}>
          Sign out
        </button>
      </div>
      {account && (
        <code className="text-xs opacity-70">key: {account.apiKey}</code>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
