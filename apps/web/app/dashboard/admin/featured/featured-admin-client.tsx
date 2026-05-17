"use client";

/**
 * S6-T25. Featured-rotation CRUD UI. Talks to /api/admin/featured (admin
 * gated, writes the app-owned `featured_servers` table).
 */

import { useCallback, useEffect, useState } from "react";

interface FeaturedItem {
  id: number;
  server_object_id: string;
  week_start: string;
  position: number;
  created_by: string | null;
}

interface ServerOpt {
  objectId: string;
  name: string;
  namespace: string;
}

export function FeaturedAdminClient({ servers }: { servers: ServerOpt[] }) {
  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [weekStart, setWeekStart] = useState("");
  const [sel, setSel] = useState("");
  const [pos, setPos] = useState(0);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/featured", { cache: "no-store" });
      const d = (await r.json()) as {
        featured?: FeaturedItem[];
        weekStart?: string;
      };
      setItems(d.featured ?? []);
      if (d.weekStart) setWeekStart(d.weekStart);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const r = await fetch("/api/admin/featured", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serverObjectId: sel,
        position: pos,
        weekStart,
      }),
    });
    const d = (await r.json()) as { ok?: boolean; error?: string };
    if (!r.ok || !d.ok) setMsg(d.error ?? "add failed");
    else {
      setSel("");
      void refresh();
    }
  }

  async function remove(serverObjectId: string, week: string) {
    await fetch("/api/admin/featured", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ serverObjectId, weekStart: week }),
    });
    void refresh();
  }

  const nameFor = (id: string) =>
    servers.find((s) => s.objectId === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <form
        onSubmit={add}
        className="rounded-xl border p-5 space-y-4"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h2 className="font-semibold">Add to featured set</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <select
            value={sel}
            onChange={(e) => setSel(e.target.value)}
            required
            className="input"
          >
            <option value="">Select a server…</option>
            {servers.map((s) => (
              <option key={s.objectId} value={s.objectId}>
                {s.name} ({s.namespace})
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={pos}
            onChange={(e) => setPos(Number(e.target.value))}
            placeholder="Position"
            className="input"
          />
          <input
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="input"
          />
        </div>
        <button className="btn btn-primary" type="submit">
          Add
        </button>
        {msg && <p className="text-xs text-red-400">{msg}</p>}
      </form>

      <div>
        <h2 className="font-semibold mb-3">Current rotation</h2>
        {loading ? (
          <p className="text-sm opacity-60">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm opacity-60">No featured servers yet.</p>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <div
                key={it.id}
                className="flex items-center justify-between rounded-lg border px-4 py-2 text-sm"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                <div>
                  <span className="font-medium">
                    #{it.position} · {nameFor(it.server_object_id)}
                  </span>
                  <span className="ml-3 opacity-60">{it.week_start}</span>
                </div>
                <button
                  onClick={() =>
                    remove(it.server_object_id, it.week_start)
                  }
                  className="text-xs underline text-red-400"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
