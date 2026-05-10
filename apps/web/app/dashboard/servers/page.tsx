"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/dashboard/user-context";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EnabledServer {
  id: string;
  server_id: string;
  enabled_at: string;
  server: {
    namespace: string;
    name: string;
    description: string;
    category: string | null;
  };
}

export default function ServersPage() {
  const user = useUser();
  const supabase = createClient();
  const [servers, setServers] = useState<EnabledServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadServers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadServers = async () => {
    const { data } = await supabase
      .from("user_enabled_servers")
      .select(`
        id,
        server_id,
        enabled_at,
        server:mcp_servers(namespace, name, description, category)
      `)
      .eq("user_id", user.id)
      .order("enabled_at", { ascending: false });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setServers((data as any) || []);
    setLoading(false);
  };

  const handleDisable = async (id: string) => {
    await supabase.from("user_enabled_servers").delete().eq("id", id);
    setServers(servers.filter((s) => s.id !== id));
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text)]">Connected MCPs</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Manage your enabled MCP servers
      </p>

      <div className="mt-6 space-y-4">
        {loading ? (
          <Card>
            <p className="text-center text-[var(--text-muted)]">Loading...</p>
          </Card>
        ) : servers.length === 0 ? (
          <Card>
            <CardTitle>No servers connected</CardTitle>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Browse the marketplace to find and enable MCP servers.
            </p>
            <Link href="/marketplace">
              <Button variant="secondary" size="sm" className="mt-4">
                Browse marketplace
              </Button>
            </Link>
          </Card>
        ) : (
          servers.map((s) => (
            <Card key={s.id}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-[var(--text)]">
                    {s.server?.name || "Unknown"}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {s.server?.description}
                  </p>
                  {s.server?.category && (
                    <span className="mt-2 inline-block rounded-full bg-[var(--surface)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                      {s.server.category}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDisable(s.id)}
                >
                  Disable
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
