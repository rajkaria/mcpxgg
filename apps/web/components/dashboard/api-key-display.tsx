"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "./user-context";
import { Button } from "@/components/ui/button";

export function ApiKeyDisplay() {
  const user = useUser();
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const maskedKey = `${"•".repeat(40)}${user.api_key.slice(-8)}`;
  const displayKey = revealed ? user.api_key : maskedKey;

  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        mcpx: {
          url: "https://mcp.mcpx.gg/mcp",
          headers: { Authorization: `Bearer ${user.api_key}` },
        },
      },
    },
    null,
    2
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(user.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyConfig = async () => {
    await navigator.clipboard.writeText(mcpConfig);
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    const res = await fetch("/api/auth/regenerate-key", { method: "POST" });

    if (res.ok) {
      setShowConfirm(false);
      setRevealed(false);
      router.refresh();
    }

    setRegenerating(false);
  };

  return (
    <div className="space-y-6">
      {/* Key display */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
          Your API Key
        </label>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-sm text-[var(--text)] break-all">
            {displayKey}
          </code>
          <Button variant="ghost" size="sm" onClick={() => setRevealed(!revealed)}>
            {revealed ? "Hide" : "Show"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </div>

      {/* MCP Config snippet */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
          MCP Configuration
        </label>
        <p className="text-xs text-[var(--text-muted)] mb-2">
          Add this to your Claude Desktop or Cursor MCP config:
        </p>
        <div className="relative">
          <pre className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 font-mono text-xs text-[var(--text)] overflow-x-auto">
            {mcpConfig}
          </pre>
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-2"
            onClick={handleCopyConfig}
          >
            {copiedConfig ? "Copied!" : "Copy"}
          </Button>
        </div>
      </div>

      {/* Regenerate */}
      <div>
        {showConfirm ? (
          <div className="rounded-lg border border-[var(--error)] border-opacity-30 bg-[var(--error)] bg-opacity-5 p-4">
            <p className="text-sm text-[var(--error)]">
              Are you sure? Your current API key will stop working immediately. Any MCP clients using it will need to be updated.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                variant="danger"
                size="sm"
                onClick={handleRegenerate}
                loading={regenerating}
              >
                Yes, regenerate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setShowConfirm(true)}>
            Regenerate API key
          </Button>
        )}
      </div>
    </div>
  );
}
