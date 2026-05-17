import { IntentManager } from "@/components/IntentManager";

export const metadata = {
  title: "Spending Intents | MCPX",
  description:
    "Authorize autonomous agents to spend from your session within hard on-chain caps.",
};

export default function IntentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Spending Intents</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Let an autonomous agent call MCP tools on your behalf, bounded by
          on-chain daily and per-call caps. Every spend is enforced by the
          Move contract — not by trust.
        </p>
      </div>
      <IntentManager />
    </div>
  );
}
