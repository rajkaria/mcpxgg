"use client";

/**
 * S6-T14/T15. Bloomberg-terminal-style live view. Cumulative metrics poll
 * /api/live/metrics every 5s (T16); the call feed streams from
 * /api/live/stream via EventSource (T15). Degrades to the polled snapshot
 * when SSE/Redis is unavailable.
 */

import { useEffect, useRef, useState } from "react";

interface Metrics {
  totalCalls: number;
  totalSettledAtomic: string;
  activeServers: number;
  activeUsers: number;
  topServers: Array<{ name: string; namespace: string | null; calls: number }>;
  activeUserList: Array<{ address: string; calls: number }>;
}

interface FeedItem {
  id: string;
  server: string;
  tool: string;
  payer: string;
  amount: string;
  ts: number;
}

function usd(atomic: string): string {
  const a = BigInt(atomic || "0");
  const whole = a / 1_000_000n;
  const frac = (a % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `$${whole.toLocaleString()}.${frac}`;
}

const short = (s: string) =>
  s && s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s;

export function LiveTerminal({ initial }: { initial: Metrics }) {
  const [metrics, setMetrics] = useState<Metrics>(initial);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/live/metrics", { cache: "no-store" });
        const m = (await r.json()) as Metrics;
        if (alive) setMetrics(m);
      } catch {
        /* keep last snapshot */
      }
    };
    const iv = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/live/stream");
      es.onmessage = (ev) => {
        try {
          const p = JSON.parse(ev.data) as {
            eventType?: string;
            data?: Record<string, unknown>;
            timestampMs?: number;
          };
          if (!p?.data) return;
          const d = p.data;
          const item: FeedItem = {
            id: `${seq.current++}`,
            server:
              (d.namespace as string) ||
              (d.server_name as string) ||
              (d.server_object_id as string) ||
              p.eventType ||
              "event",
            tool: (d.tool_name as string) || (p.eventType ?? ""),
            payer:
              (d.payer_address as string) ||
              (d.owner_address as string) ||
              "",
            amount: String(d.amount_atomic ?? "0"),
            ts: p.timestampMs ?? Date.now(),
          };
          setFeed((prev) => [item, ...prev].slice(0, 50));
        } catch {
          /* ignore malformed frame */
        }
      };
      es.onerror = () => {
        /* EventSource auto-retries; nothing to do */
      };
    } catch {
      /* SSE unsupported — polled metrics still render */
    }
    return () => es?.close();
  }, []);

  const stat = (label: string, value: string) => (
    <div
      className="rounded-lg border p-4"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.2em]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-2xl font-bold tabular-nums"
        style={{ fontFamily: "var(--font-jetbrains-mono)" }}
      >
        {value}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stat("Calls (24h)", metrics.totalCalls.toLocaleString())}
        {stat("Settled (24h)", usd(metrics.totalSettledAtomic))}
        {stat("Active servers", metrics.activeServers.toLocaleString())}
        {stat("Active users", metrics.activeUsers.toLocaleString())}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          className="lg:col-span-2 rounded-xl border overflow-hidden"
          style={{ borderColor: "var(--border)" }}
        >
          <div
            className="px-4 py-2 text-xs font-semibold flex items-center gap-2"
            style={{ background: "var(--surface)" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "var(--success)" }}
            />
            LIVE CALL FEED
          </div>
          <div
            className="h-[420px] overflow-y-auto text-xs font-mono"
            style={{ fontFamily: "var(--font-jetbrains-mono)" }}
          >
            {feed.length === 0 ? (
              <div className="p-6 opacity-50">
                Waiting for settled calls…
              </div>
            ) : (
              feed.map((f) => (
                <div
                  key={f.id}
                  className="px-4 py-2 border-t flex items-center gap-3"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span style={{ color: "var(--text-muted)" }}>
                    {new Date(f.ts).toLocaleTimeString()}
                  </span>
                  <span
                    className="font-semibold truncate"
                    style={{ color: "var(--primary)" }}
                  >
                    {f.server}
                  </span>
                  <span className="opacity-70 truncate">{f.tool}</span>
                  <span className="ml-auto" style={{ color: "var(--success)" }}>
                    {usd(f.amount)}
                  </span>
                  <span className="opacity-50">{short(f.payer)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div
            className="rounded-xl border"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="px-4 py-2 text-xs font-semibold"
              style={{ background: "var(--surface)" }}
            >
              TOP SERVERS
            </div>
            <div className="p-3 space-y-2 text-sm">
              {metrics.topServers.length === 0 ? (
                <p className="opacity-50 text-xs">No activity yet.</p>
              ) : (
                metrics.topServers.map((s) => (
                  <div
                    key={s.namespace ?? s.name}
                    className="flex justify-between gap-2"
                  >
                    <span className="truncate">{s.name}</span>
                    <span
                      className="tabular-nums"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {s.calls}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div
            className="rounded-xl border"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="px-4 py-2 text-xs font-semibold"
              style={{ background: "var(--surface)" }}
            >
              ACTIVE USERS
            </div>
            <div className="p-3 space-y-2 text-xs font-mono">
              {metrics.activeUserList.length === 0 ? (
                <p className="opacity-50">No activity yet.</p>
              ) : (
                metrics.activeUserList.map((u) => (
                  <div key={u.address} className="flex justify-between gap-2">
                    <span className="opacity-70">{short(u.address)}</span>
                    <span style={{ color: "var(--text-muted)" }}>
                      {u.calls}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
