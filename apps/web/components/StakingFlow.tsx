"use client";

/**
 * <StakingFlow /> (S7-T10). A developer locks USDsui as SLA collateral on one
 * of their servers, picks an SLA tier (95 / 99 / 99.9), and a lock duration.
 * Slashed stake (auto-slashed by the quality oracle when the committed SLA is
 * breached for ≥2 consecutive windows) shows in the history.
 *
 * Architecture is identical to <IntentManager /> / <RechargeFlow />: the
 * server builds the Move PTB (/api/stakes) and the Privy embedded wallet
 * signs+submits. The web never writes the `stakes` mirror — rows appear once
 * the indexer mirrors StakePosted/StakeSlashed.
 */

import { useCallback, useEffect, useState } from "react";
import {
  usePrivy,
  useSignTransaction,
  getAccessToken,
} from "@privy-io/react-auth";

interface SlashDTO {
  amountAtomic: string;
  reason: string;
  slashedAt: string;
  txDigest: string | null;
}

interface StakeDTO {
  stakeObjectId: string;
  serverObjectId: string;
  amountAtomic: string;
  remainingAtomic: string;
  slaUptimeX100: number;
  txDigest: string | null;
  createdAt: string;
  slashes: SlashDTO[];
}

const TIERS = ["95", "99", "99.9"] as const;
type Tier = (typeof TIERS)[number];

function usd(atomic: string): string {
  const a = BigInt(atomic || "0");
  const whole = a / 1_000_000n;
  const frac = (a % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `$${whole.toString()}.${frac}`;
}

function tierLabel(slaUptimeX100: number): Tier {
  if (slaUptimeX100 >= 9990) return "99.9";
  if (slaUptimeX100 >= 9900) return "99";
  return "95";
}

type Phase = "idle" | "working" | "error" | "done";

export function StakingFlow() {
  const { authenticated, login } = usePrivy();
  const { signTransaction } = useSignTransaction();

  const [stakes, setStakes] = useState<StakeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");

  const [serverObjectId, setServerObjectId] = useState("");
  const [amount, setAmount] = useState(50);
  const [tier, setTier] = useState<Tier>("99");
  const [lockDays, setLockDays] = useState(30);

  const refresh = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/stakes", {
        headers: { authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as { stakes?: StakeDTO[] };
      setStakes(data.stakes ?? []);
    } catch {
      setStakes([]);
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

  async function postStake(e: React.FormEvent) {
    e.preventDefault();
    setPhase("working");
    setMsg("");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/stakes", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          serverObjectId: serverObjectId.trim(),
          amountUsd: amount,
          slaTier: tier,
          lockDurationDays: lockDays,
        }),
      });
      const data = (await res.json()) as { txBytesB64?: string; error?: string };
      if (!res.ok || !data.txBytesB64) {
        throw new Error(data.error ?? `stake failed (${res.status})`);
      }
      await signBuilt(data.txBytesB64);
      setPhase("done");
      setMsg("Stake submitted. It appears here once indexed.");
      setServerObjectId("");
      setTimeout(() => void refresh(), 4000);
    } catch (err) {
      setPhase("error");
      setMsg(err instanceof Error ? err.message : "stake error");
    }
  }

  async function withdraw(stakeObjectId: string, remainingAtomic: string) {
    setPhase("working");
    setMsg("");
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/stakes", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stakeObjectId,
          amountUsd: Number(BigInt(remainingAtomic)) / 1_000_000,
        }),
      });
      const data = (await res.json()) as { txBytesB64?: string; error?: string };
      if (!res.ok || !data.txBytesB64) {
        throw new Error(data.error ?? `withdraw failed (${res.status})`);
      }
      await signBuilt(data.txBytesB64);
      setPhase("done");
      setMsg("Withdrawal submitted (subject to the on-chain lock).");
      setTimeout(() => void refresh(), 4000);
    } catch (err) {
      setPhase("error");
      setMsg(err instanceof Error ? err.message : "withdraw error");
    }
  }

  if (!authenticated) {
    return (
      <button className="btn btn-primary" onClick={() => login()}>
        Sign in to stake on your servers
      </button>
    );
  }

  const busy = phase === "working";

  return (
    <div className="space-y-8">
      <form
        onSubmit={postStake}
        className="rounded-2xl border p-6 space-y-4"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h2 className="text-lg font-semibold">Lock an SLA stake</h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Stake USDsui as collateral against an uptime commitment. If the
          quality oracle measures your server below the committed SLA for two
          consecutive 6-hour windows, a proportional amount is automatically
          slashed to the insurance pool. Higher commitments earn more trust.
        </p>

        <div>
          <label className="text-sm font-medium">Server object id</label>
          <input
            value={serverObjectId}
            onChange={(e) => setServerObjectId(e.target.value)}
            placeholder="0x…"
            required
            className="input mt-1 w-full font-mono text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium">Stake (USD)</label>
            <input
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="input mt-1 w-full"
            />
          </div>
          <div>
            <label className="text-sm font-medium">SLA tier (% uptime)</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as Tier)}
              className="input mt-1 w-full"
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}%
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Lock (days)</label>
            <input
              type="number"
              min={1}
              value={lockDays}
              onChange={(e) => setLockDays(Number(e.target.value))}
              className="input mt-1 w-full"
            />
          </div>
        </div>

        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? "Confirm in wallet…" : "Lock stake"}
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
        <h2 className="text-lg font-semibold mb-3">Your stakes</h2>
        {loading ? (
          <p className="text-sm opacity-60">Loading…</p>
        ) : stakes.length === 0 ? (
          <p className="text-sm opacity-60">
            No stakes yet. Lock one above to signal SLA confidence.
          </p>
        ) : (
          <div className="space-y-3">
            {stakes.map((s) => {
              const slashedTotal = s.slashes.reduce(
                (a, x) => a + BigInt(x.amountAtomic),
                0n,
              );
              return (
                <div
                  key={s.stakeObjectId}
                  className="rounded-xl border p-4"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <code className="text-xs opacity-70 break-all">
                        {s.serverObjectId}
                      </code>
                      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs opacity-80">
                        <span>
                          🔒 Staked: {usd(s.amountAtomic)} @{" "}
                          {tierLabel(s.slaUptimeX100)}% SLA
                        </span>
                        <span>Remaining: {usd(s.remainingAtomic)}</span>
                        {slashedTotal > 0n && (
                          <span className="text-red-400">
                            Slashed: {usd(slashedTotal.toString())}
                          </span>
                        )}
                      </div>
                      {s.slashes.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-[11px] uppercase tracking-wide opacity-60">
                            Slash history
                          </p>
                          {s.slashes.map((sl, i) => (
                            <div
                              key={i}
                              className="text-[11px] opacity-70 border-l-2 pl-2"
                              style={{ borderColor: "var(--border)" }}
                            >
                              <span className="text-red-400">
                                −{usd(sl.amountAtomic)}
                              </span>{" "}
                              · {new Date(sl.slashedAt).toLocaleString()} ·{" "}
                              {sl.reason}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {BigInt(s.remainingAtomic) > 0n && (
                        <button
                          onClick={() =>
                            withdraw(s.stakeObjectId, s.remainingAtomic)
                          }
                          disabled={busy}
                          className="text-xs underline"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Withdraw
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
