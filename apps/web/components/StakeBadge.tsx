/**
 * <StakeBadge /> (S7-T11). Server-rendered "🔒 $X staked at 99% SLA" trust
 * badge. Reads the indexer `stakes` mirror (via getServerStake, passed in by
 * the page) — never chain RPC, never written by the web (ADR-011).
 */

interface StakeBadgeProps {
  /** Remaining (post-slash) staked amount in USDsui atomic units, or null. */
  remainingAtomic: bigint | null;
  /** Committed SLA uptime ×100 (9500 | 9900 | 9990). */
  slaUptimeX100: number | null;
  size?: "sm" | "md";
}

function slaTier(slaUptimeX100: number): string {
  if (slaUptimeX100 >= 9990) return "99.9";
  if (slaUptimeX100 >= 9900) return "99";
  return "95";
}

function usd(atomic: bigint): string {
  const whole = atomic / 1_000_000n;
  const frac = (atomic % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return frac === "00"
    ? `$${whole.toString()}`
    : `$${whole.toString()}.${frac}`;
}

export function StakeBadge({
  remainingAtomic,
  slaUptimeX100,
  size = "sm",
}: StakeBadgeProps) {
  if (
    remainingAtomic === null ||
    remainingAtomic <= 0n ||
    slaUptimeX100 === null ||
    slaUptimeX100 <= 0
  ) {
    return null;
  }
  const text = `🔒 ${usd(remainingAtomic)} staked at ${slaTier(slaUptimeX100)}% SLA`;
  return (
    <span
      title="Developer-locked USDsui collateral. Auto-slashed to the insurance pool on sustained SLA breach."
      className={`inline-flex items-center gap-1 rounded-full font-medium ${
        size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[11px]"
      }`}
      style={{
        background: "var(--primary-glow)",
        color: "var(--primary)",
        border: "1px solid var(--primary)",
      }}
    >
      {text}
    </span>
  );
}
