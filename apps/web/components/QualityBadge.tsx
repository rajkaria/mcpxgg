/**
 * S6-T19. Quality score badge. `scoreX100` is the on-chain
 * QualityAttestation score (0..10000 → 0..100%). Color-graded; renders
 * nothing when there is no attestation yet.
 */

export function QualityBadge({
  scoreX100,
  size = "sm",
}: {
  scoreX100: number | null | undefined;
  size?: "sm" | "md";
}) {
  if (scoreX100 == null || scoreX100 <= 0) return null;
  const pct = Math.round(scoreX100 / 100);

  const color =
    pct >= 90
      ? "var(--success)"
      : pct >= 70
        ? "var(--warning)"
        : "var(--error, #ef4444)";

  const pad = size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]";

  return (
    <span
      title={`Quality score: ${pct}% (on-chain attested)`}
      className={`inline-flex items-center gap-1 rounded-md font-semibold ${pad}`}
      style={{ background: "var(--surface)", color }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: color }}
      />
      {pct}% quality
    </span>
  );
}
