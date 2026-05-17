"use client";

/**
 * S4-T14 setup wizard. Pick an AI client → get the exact config to paste.
 * The gateway speaks MCP JSON-RPC at GATEWAY_URL; mcpx.gg/api/mcp proxies
 * it for backward compat.
 */

import { useState } from "react";

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL ?? "https://mcp.mcpx.gg";

type ClientId = "cursor" | "claude" | "windsurf" | "cline" | "api";

const CLIENTS: { id: ClientId; label: string }[] = [
  { id: "cursor", label: "Cursor" },
  { id: "claude", label: "Claude Desktop" },
  { id: "windsurf", label: "Windsurf" },
  { id: "cline", label: "Cline" },
  { id: "api", label: "Raw API" },
];

function configFor(client: ClientId, apiKey: string): string {
  const key = apiKey || "mcpx_sk_<your-key>";
  const mcp = {
    mcpServers: {
      mcpxgg: {
        url: `${GATEWAY_URL}/`,
        headers: { Authorization: `Bearer ${key}` },
      },
    },
  };
  switch (client) {
    case "cursor":
      return JSON.stringify(mcp, null, 2) + "\n// → ~/.cursor/mcp.json";
    case "claude":
      return (
        JSON.stringify(mcp, null, 2) +
        "\n// → claude_desktop_config.json (Settings → Developer)"
      );
    case "windsurf":
      return JSON.stringify(mcp, null, 2) + "\n// → ~/.codeium/windsurf/mcp_config.json";
    case "cline":
      return JSON.stringify(mcp, null, 2) + "\n// → Cline MCP Servers settings";
    case "api":
      return [
        `curl -X POST ${GATEWAY_URL}/ \\`,
        `  -H "Authorization: Bearer ${key}" \\`,
        `  -H "content-type: application/json" \\`,
        `  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`,
      ].join("\n");
  }
}

export function SetupWizard({ apiKey }: { apiKey: string | null }) {
  const [client, setClient] = useState<ClientId>("cursor");
  const [copied, setCopied] = useState(false);
  const cfg = configFor(client, apiKey ?? "");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {CLIENTS.map((c) => (
          <button
            key={c.id}
            onClick={() => setClient(c.id)}
            className="px-3 py-1.5 rounded-lg text-sm border"
            style={{
              borderColor: "var(--border)",
              background: client === c.id ? "var(--primary)" : "transparent",
              color: client === c.id ? "#fff" : "var(--text-secondary)",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      {!apiKey && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Sign in to embed your real API key automatically.
        </p>
      )}
      <pre className="overflow-x-auto rounded-lg bg-black/30 p-4 text-xs">{cfg}</pre>
      <button
        className="btn btn-primary self-start text-sm"
        onClick={() => {
          void navigator.clipboard.writeText(cfg);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy config"}
      </button>
    </div>
  );
}
