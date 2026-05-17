/**
 * /setup (S4-T14) — per-client config wizard. Server component injects the
 * signed-in user's API key into the generated config.
 */

import { getCurrentUser } from "@/lib/auth/current-user";
import { SetupWizard } from "@/components/SetupWizard";

export const metadata = { title: "Setup | MCPX" };

export default async function SetupPage() {
  const user = await getCurrentUser();
  return (
    <div className="mx-auto max-w-3xl p-6 pt-24">
      <h1 className="text-2xl font-semibold">Connect your AI client</h1>
      <p className="mt-1 mb-6 text-sm opacity-70">
        Point your client at the mcpxgg gateway. Every tool call settles in
        USDsui and returns an on-chain receipt.
      </p>
      <SetupWizard apiKey={user?.apiKey ?? null} />
    </div>
  );
}
