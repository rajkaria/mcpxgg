/**
 * S8-T10 — public status page (stands in for status.mcpx.gg). Per-service
 * up/down/unknown from a single short-timeout server-side probe of each
 * service's health endpoint (env-configurable base URLs). Honest by design:
 * services with no configured URL show "unknown", not a fabricated green.
 */

import type { Metadata } from "next";
import { probeAllServices, type ServiceState } from "@/lib/status/probe";
import { MarketingNav, MarketingFooter } from "@/components/marketing/MarketingShell";

export const metadata: Metadata = {
  title: "Status",
  description:
    "Live health of the MCPX web app, gateway, x402 facilitator, indexer, and quality oracle.",
  alternates: { canonical: "/status" },
  robots: { index: true, follow: true },
};

// Always re-probe; never serve a cached health snapshot.
export const dynamic = "force-dynamic";

const STATE_META: Record<
  ServiceState,
  { label: string; color: string; dot: string }
> = {
  up: { label: "Operational", color: "var(--success)", dot: "var(--success)" },
  down: { label: "Disruption", color: "var(--error)", dot: "var(--error)" },
  unknown: {
    label: "Unknown",
    color: "var(--text-muted)",
    dot: "var(--text-muted)",
  },
};

export default async function StatusPage() {
  const services = await probeAllServices();
  const anyDown = services.some((s) => s.state === "down");
  const allUp =
    services.length > 0 && services.every((s) => s.state === "up");
  const overall = anyDown
    ? { label: "Some systems are experiencing a disruption", color: "var(--error)" }
    : allUp
      ? { label: "All systems operational", color: "var(--success)" }
      : { label: "Status partially available", color: "var(--text-muted)" };

  return (
    <div
      className="min-h-screen relative"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <MarketingNav active="" />

      <main className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        <header className="mb-10">
          <p
            className="text-sm font-medium uppercase tracking-[0.2em] mb-4"
            style={{ color: "var(--primary)" }}
          >
            System status
          </p>
          <div className="flex items-center gap-3">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: overall.color }}
              aria-hidden="true"
            />
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {overall.label}
            </h1>
          </div>
          <p
            className="mt-3 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            Checked just now. Each service is probed with a 3-second timeout;
            services without a configured endpoint show as unknown rather than
            assumed healthy.
          </p>
        </header>

        <ul className="space-y-3">
          {services.map((s) => {
            const meta = STATE_META[s.state];
            return (
              <li
                key={s.key}
                className="rounded-xl border p-5 flex items-center justify-between gap-4"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                }}
              >
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p
                    className="text-sm mt-0.5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {s.description}
                  </p>
                  {!s.configured && (
                    <p
                      className="text-xs mt-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      No public endpoint configured for this environment.
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span
                    className="inline-flex items-center gap-2 text-sm font-medium"
                    style={{ color: meta.color }}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: meta.dot }}
                      aria-hidden="true"
                    />
                    {meta.label}
                  </span>
                  {s.latencyMs != null && (
                    <p
                      className="text-xs mt-1 font-mono"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {s.latencyMs} ms
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <p
          className="mt-10 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          On-chain state lives on Sui and is independent of these services —
          settled receipts are permanent regardless of gateway uptime. For
          settlement volume and live activity see{" "}
          <a href="/live" className="underline">
            the live feed
          </a>
          .
        </p>
      </main>

      <MarketingFooter />
    </div>
  );
}
