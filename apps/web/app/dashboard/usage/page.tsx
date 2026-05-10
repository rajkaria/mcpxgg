"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/dashboard/user-context";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface RequestLogEntry {
  id: string;
  tool_name: string;
  credit_cost: number;
  status: string;
  response_time_ms: number | null;
  error_message: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  success: "text-[var(--success)]",
  error: "text-[var(--error)]",
  timeout: "text-[var(--warning)]",
  refunded: "text-[var(--text-muted)]",
};

export default function UsagePage() {
  const user = useUser();
  const supabase = createClient();
  const [entries, setEntries] = useState<RequestLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const loadEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("request_log")
      .select("id, tool_name, credit_cost, status, response_time_ms, error_message, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data as any) || [];
    setEntries(rows);
    setHasMore(rows.length === pageSize);
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text)]">Usage History</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Your MCP tool call history
      </p>

      <Card className="mt-6">
        <CardTitle>Request Log</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--text-muted)]">
                <th className="pb-2 font-medium">Time</th>
                <th className="pb-2 font-medium">Tool</th>
                <th className="pb-2 font-medium">Credits</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 text-right font-medium">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-[var(--text-muted)]">
                    Loading...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-[var(--text-muted)]">
                    No usage yet
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-2 text-[var(--text-secondary)]">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 font-mono text-xs text-[var(--text)]">
                      {entry.tool_name}
                    </td>
                    <td className="py-2 text-[var(--text)]">{entry.credit_cost}</td>
                    <td className={`py-2 ${STATUS_COLORS[entry.status] || ""}`}>
                      {entry.status}
                    </td>
                    <td className="py-2 text-right text-[var(--text-secondary)]">
                      {entry.response_time_ms ? `${entry.response_time_ms}ms` : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
          >
            Previous
          </Button>
          <span className="text-xs text-[var(--text-muted)]">Page {page + 1}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={!hasMore}
          >
            Next
          </Button>
        </div>
      </Card>
    </div>
  );
}
