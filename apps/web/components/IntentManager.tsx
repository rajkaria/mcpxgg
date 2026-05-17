"use client";

/**
 * <IntentManager /> (S6-T05). Lists the signed-in user's SpendingIntents and
 * lets agent/power users create + revoke them. The create/revoke actions
 * build a Move PTB server-side (/api/intents) and the Privy embedded wallet
 * signs+submits — identical to <RechargeFlow />. The web never writes the
 * `intents` mirror; it appears once the indexer mirrors the events.
 */

import { useCallback, useEffect, useState } from "react";
import {
  usePrivy,
  useSignTransaction,
  getAccessToken,
} from "@privy-io/react-auth";

interface IntentDTO {
  intentObjectId: string;
  agentAddress: string;
  dailyCapAtomic: string;
  perCallCapAtomic: string;
  allowedCategories: string[];
  serverIds: string[];
  expiresAtMs: string;
  todaySpentAtomic: string;
  lifetimeSpentAtomic: string;
  status: string;
}

const CATEGORIES = [
  "Intelligence",
  "Analytics",
  "Code Tools",
  "Data",
  "Communication",
  "Productivity",
  "Security",
  "DevOps",
];

function usd(atomic: string): string {
  const a = BigInt(atomic || "0");
  const whole = a / 1_000_000n;
  const frac = (a % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `$${whole.toString()}.${frac}`;
}

type Phase = "idle" | "working" | "error" | "done";

export function IntentManager() {
  const { authenticated, login } = usePrivy();
  const { signTransaction } = useSignTransaction();

  const [intents, setIntents] = useState<IntentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [agent, setAgent] = useState("");
  const [dailyCap, setDailyCap] = useState(5);
  const [perCallCap, setPerCallCap] = useState(0.5);
  const [cats, setCats] = useState<string[]>([]);
  const [serverIds, setServerIds] = useState("");
  const [expiryDays, setExpiryDays] = useState(30);

  const refresh = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/intents", {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { intents?: IntentDTO[] };
      setIntents(data.intents ?? []);
    } catch {
      setIntents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authenticated) void refresh();
    else setLoading(false);
  }, [authenticated, refresh]);

  async function signBuilt(txBytesB64: string) {
    await signTransaction({
      transaction: txBytesB64,
      chain: "sui",
    } as unknown as Parameters<typeof signTransaction>[0]);
  }

  async function createIntent(e: React.FormEvent) {
    e.preventDefault();
    setPhase("working");
    setMsg("");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/intents", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentAddress: agent.trim(),
          dailyCapUsd: dailyCap,
          perCallCapUsd: perCallCap,
          allowedCategories: cats,
          serverObjectIds: serverIds
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          expiresAtMs: Date.now() + expiryDays * 24 * 60 * 60 * 1000,
        }),
      });
      const data = (await res.json()) as { txBytesB64?: string; error?: string };
      if (!res.ok || !data.txBytesB64) {
        throw new Error(data.error ?? `create failed (${res.status})`);
      }
      await signBuilt(data.txBytesB64);
      setPhase("done");
      setMsg("Intent submitted. It appears here once indexed.");
      setAgent("");
      setTimeout(() => void refresh(), 4000);
    } catch (err) {
      setPhase("error");
      setMsg(err instanceof Error ? err.message : "create error");
    }
  }

  async function revoke(intentObjectId: string) {
    setPhase("working");
    setMsg("");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/intents", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ intentObjectId }),
      });
      const data = (await res.json()) as { txBytesB64?: string; error?: string };
      if (!res.ok || !data.txBytesB64) {
        throw new Error(data.error ?? `revoke failed (${res.status})`);
      }
      await signBuilt(data.txBytesB64);
      setPhase("done");
      setMsg("Revocation submitted.");
      setTimeout(() => void refresh(), 4000);
    } catch (err) {
      setPhase("error");
      setMsg(err instanceof Error ? err.message : "revoke error");
    }
  }

  if (!authenticated) {
    return (
      <button className="btn btn-primary" onClick={() => login()}>
        Sign in to manage spending intents
      </button>
    );
  }

  const busy = phase === "working";

  return (
    <div className="space-y-8">
      <form
        onSubmit={createIntent}
        className="rounded-2xl border p-6 space-y-4"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h2 className="text-lg font-semibold">Authorize an agent</h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          A SpendingIntent lets an autonomous agent spend from your session
          within hard on-chain caps. Revoke any time.
        </p>

        <div>
          <label className="text-sm font-medium">Agent Sui address</label>
          <input
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            placeholder="0x…"
            required
            className="input mt-1 w-full font-mono text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Daily cap (USD)</label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={dailyCap}
              onChange={(e) => setDailyCap(Number(e.target.value))}
              className="input mt-1 w-full"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Per-call cap (USD)</label>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={perCallCap}
              onChange={(e) => setPerCallCap(Number(e.target.value))}
              className="input mt-1 w-full"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-sm underline"
          style={{ color: "var(--primary)" }}
        >
          {showAdvanced ? "Hide advanced" : "Advanced"}
        </button>

        {showAdvanced && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">
                Allowed categories (none = any)
              </label>
              <div className="flex flex-wrap gap-2 mt-2">
                {CATEGORIES.map((c) => {
                  const on = cats.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        setCats((prev) =>
                          on ? prev.filter((x) => x !== c) : [...prev, c],
                        )
                      }
                      className="px-3 py-1 rounded-full text-xs border"
                      style={{
                        background: on ? "var(--primary)" : "transparent",
                        color: on ? "#fff" : "var(--text-secondary)",
                        borderColor: on ? "var(--primary)" : "var(--border)",
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">
                Scoped server object ids (comma-separated, optional)
              </label>
              <input
                value={serverIds}
                onChange={(e) => setServerIds(e.target.value)}
                placeholder="0x…, 0x…"
                className="input mt-1 w-full font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Expires in (days)</label>
              <input
                type="number"
                min={1}
                value={expiryDays}
                onChange={(e) => setExpiryDays(Number(e.target.value))}
                className="input mt-1 w-full"
              />
            </div>
          </div>
        )}

        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "Confirm in wallet…" : "Create intent"}
        </button>
        {msg && (
          <p
            className={`text-xs ${phase === "error" ? "text-red-400" : "text-emerald-400"}`}
          >
            {msg}
          </p>
        )}
      </form>

      <div>
        <h2 className="text-lg font-semibold mb-3">Active intents</h2>
        {loading ? (
          <p className="text-sm opacity-60">Loading…</p>
        ) : intents.length === 0 ? (
          <p className="text-sm opacity-60">
            No intents yet. Authorize an agent above.
          </p>
        ) : (
          <div className="space-y-3">
            {intents.map((i) => (
              <div
                key={i.intentObjectId}
                className="rounded-xl border p-4"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <code className="text-xs opacity-70 break-all">
                      {i.agentAddress}
                    </code>
                    <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs opacity-80">
                      <span>Daily cap: {usd(i.dailyCapAtomic)}</span>
                      <span>Per-call cap: {usd(i.perCallCapAtomic)}</span>
                      <span>Today: {usd(i.todaySpentAtomic)}</span>
                      <span>Lifetime: {usd(i.lifetimeSpentAtomic)}</span>
                    </div>
                    {i.allowedCategories.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {i.allowedCategories.map((c) => (
                          <span
                            key={c}
                            className="px-2 py-0.5 rounded text-[10px]"
                            style={{
                              background: "var(--bg)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] uppercase"
                      style={{
                        background:
                          i.status === "active"
                            ? "var(--primary-glow)"
                            : "var(--bg)",
                        color:
                          i.status === "active"
                            ? "var(--primary)"
                            : "var(--text-muted)",
                      }}
                    >
                      {i.status}
                    </span>
                    {i.status === "active" && (
                      <button
                        onClick={() => revoke(i.intentObjectId)}
                        disabled={busy}
                        className="text-xs underline text-red-400"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
