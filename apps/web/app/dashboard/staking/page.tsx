import { StakingFlow } from "@/components/StakingFlow";

export const metadata = {
  title: "SLA Staking | MCPX",
  description:
    "Lock USDsui as SLA collateral on your servers. Auto-slashed by the quality oracle on sustained SLA breach.",
};

export default function StakingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">SLA Staking</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Put collateral behind your uptime promise. The quality oracle
          measures every server on a 6-hour window; sustained SLA breaches
          (≥2 consecutive windows) are automatically slashed to the insurance
          pool. A funded stake shows a trust badge on your server page.
        </p>
      </div>
      <StakingFlow />
    </div>
  );
}
