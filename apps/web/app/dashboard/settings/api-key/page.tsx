import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { ApiKeyDisplay } from "@/components/dashboard/api-key-display";

export default function ApiKeyPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text)]">API Key</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Manage your MCPX API key for MCP connections
      </p>

      <Card className="mt-6">
        <CardTitle>API Key Management</CardTitle>
        <CardDescription>
          Use this key to authenticate your MCP client (Claude Desktop, Cursor, etc.) with MCPX.
        </CardDescription>
        <div className="mt-4">
          <ApiKeyDisplay />
        </div>
      </Card>
    </div>
  );
}
