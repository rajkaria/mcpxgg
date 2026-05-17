/**
 * S8-T11 — public, read-only roadmap. Renders the curated typed mirror in
 * lib/content/roadmap.ts (NOT the raw SPRINTS.md markdown). Static content;
 * no chain reads, no Supabase — safe to statically render.
 */

import type { Metadata } from "next";
import { ROADMAP } from "@/lib/content/roadmap";
import { MarketingNav, MarketingFooter } from "@/components/marketing/MarketingShell";

export const metadata: Metadata = {
  title: "Roadmap",
  description:
    "What's next for MCPX after mainnet: org sessions, recoverable wallets, on-chain bounties, cross-chain payouts, on-chain reviews, and more.",
  alternates: { canonical: "/roadmap" },
  openGraph: {
    title: "MCPX Roadmap",
    description:
      "The post-mainnet plan for MCPX — Tier B growth and Tier C defensibility.",
    url: "/roadmap",
  },
};

export default function RoadmapPage() {
  return (
    <div
      className="min-h-screen relative"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <MarketingNav active="Roadmap" />

      <main className="max-w-5xl mx-auto px-6 pt-32 pb-24">
        <header className="relative mb-16">
          <div
            className="hero-glow-secondary"
            style={{ top: "-120px", left: "50%", transform: "translateX(-50%)" }}
          />
          <p
            className="text-sm font-medium uppercase tracking-[0.2em] mb-4 relative"
            style={{ color: "var(--primary)" }}
          >
            Public roadmap
          </p>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight relative">
            Where MCPX is <span className="text-gradient">going</span>
          </h1>
          <p
            className="mt-5 text-lg max-w-2xl relative"
            style={{ color: "var(--text-secondary)" }}
          >
            The plan after mainnet. This is a curated mirror of our internal
            sprint plan — directionally accurate, not a delivery commitment.
            Items ship roughly one milestone per week, in order.
          </p>
        </header>

        <div className="space-y-20">
          {ROADMAP.map((section) => (
            <section key={section.phase}>
              <div className="mb-8">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {section.phase}
                </h2>
                <p
                  className="mt-2 text-base"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {section.blurb}
                </p>
              </div>

              <ol className="grid gap-6 md:grid-cols-2">
                {section.items.map((item) => (
                  <li
                    key={item.code}
                    className="card-premium p-7 flex flex-col"
                  >
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <span
                        className="text-xs font-mono font-bold tracking-wider"
                        style={{ color: "var(--primary)" }}
                      >
                        MILESTONE {item.sprint}
                      </span>
                      <span
                        className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{
                          background: "var(--primary-glow)",
                          color: "var(--primary)",
                        }}
                      >
                        {item.code}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold mb-1">{item.title}</h3>
                    <p
                      className="text-sm mb-4"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {item.goal}
                    </p>
                    <ul className="space-y-2 mt-auto">
                      {item.highlights.map((h) => (
                        <li
                          key={h}
                          className="flex items-start gap-2.5 text-sm"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            className="mt-0.5 shrink-0"
                            style={{ color: "var(--success)" }}
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4.5 12.75l6 6 9-13.5"
                            />
                          </svg>
                          {h}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>

        <p
          className="mt-16 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          Shipped already: spending intents, pay-per-output streaming, SLA
          staking with auto-slash, the treasury insurance pool, composable
          bundles, embeddable widgets, and five first-party anchor servers.
        </p>
      </main>

      <MarketingFooter />
    </div>
  );
}
