/**
 * S8-T17 — developers. USDsui economics, vault auto-claim, SLA staking, and
 * a payout-chain selector preview (cross-chain payouts ship in roadmap S15).
 * No credits / Stripe / weekly-batch language.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { RevenueCalculator } from "@/components/RevenueCalculator";
import { MarketingNav, MarketingFooter } from "@/components/marketing/MarketingShell";

export const metadata: Metadata = {
  title: "For Developers",
  description:
    "Publish MCP servers and keep 97.5% of every call, paid straight to an on-chain Sui vault with auto-claim. Stake for an SLA badge. Cross-chain payouts coming soon.",
  alternates: { canonical: "/developers" },
  openGraph: { url: "/developers" },
};

const steps = [
  {
    num: "01",
    title: "Build from the template",
    desc: "Clone the open-source starter, follow PROMPT.md, and build your MCP server in any language. Local-first, offline by default.",
  },
  {
    num: "02",
    title: "Publish with one config",
    desc: "Add an mcpx.config.json and publish via the CLI. Pass the automated quality gate and your server is live and discoverable.",
  },
  {
    num: "03",
    title: "Earn to your vault",
    desc: "Every call settles on Sui and credits your on-chain vault with 97.5% of the price. Auto-claim sweeps it to your wallet.",
  },
];

const features = [
  {
    title: "On-chain vault with auto-claim",
    desc: "Earnings accrue to a Sui vault you own. Set an auto-claim threshold and it sweeps to your wallet automatically — no payment processor, no minimum payout imposed by a third party.",
  },
  {
    title: "SLA staking + auto-slash",
    desc: "Stake USDsui against an uptime SLA to earn a trust badge that ranks you higher in the marketplace. Miss the SLA and the stake is slashed automatically — skin in the game, on-chain.",
  },
  {
    title: "Quality-ranked discovery",
    desc: "An independent oracle attests rolling uptime, latency, and error rate. Good servers rank higher with zero marketing spend.",
  },
  {
    title: "Permanent receipts",
    desc: "Every call mints a CallReceipt on Sui with its payload archived on Walrus — verifiable proof of work, composable by other apps.",
  },
];

const payoutChains = [
  { name: "Sui", token: "USDsui", status: "Live", color: "var(--success)" },
  { name: "Base", token: "USDC", status: "Coming soon", color: "var(--text-muted)" },
  { name: "Solana", token: "USDC", status: "Coming soon", color: "var(--text-muted)" },
];

export default function DevelopersPage() {
  return (
    <div
      className="min-h-screen relative"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <MarketingNav active="Developers" />

      <section className="relative pt-32 pb-20 px-6 text-center overflow-hidden">
        <div
          className="hero-glow"
          style={{ top: "-200px", left: "50%", transform: "translateX(-50%)" }}
          aria-hidden="true"
        />
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 glass">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "var(--success)" }}
              aria-hidden="true"
            />
            <span style={{ color: "var(--text-secondary)" }}>
              Open for developers
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6">
            Build MCP servers.
            <br />
            <span className="text-gradient">Earn in USDsui.</span>
          </h1>
          <p
            className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Publish in hours. Keep 97.5% of every call, paid straight to an
            on-chain Sui vault. No payment processor, no minimum threshold.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup?developer=true">
              <Button variant="primary" size="lg" className="btn-shine">
                Start building
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="secondary" size="lg">
                See live servers
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Revenue calculator */}
      <section className="pb-24 px-6" aria-labelledby="calc-heading">
        <div className="max-w-3xl mx-auto">
          <h2 id="calc-heading" className="sr-only">
            Revenue calculator
          </h2>
          <RevenueCalculator />
        </div>
      </section>

      <div className="divider-gradient" aria-hidden="true" />

      {/* How it works */}
      <section className="py-24 px-6" aria-labelledby="dev-how-heading">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p
              className="text-sm font-medium uppercase tracking-[0.2em] mb-4"
              style={{ color: "var(--primary)" }}
            >
              How it works
            </p>
            <h2
              id="dev-how-heading"
              className="text-3xl md:text-5xl font-bold tracking-tight"
            >
              From idea to on-chain revenue
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 stagger">
            {steps.map((step) => (
              <div key={step.num} className="card-premium p-8">
                <span
                  className="text-xs font-mono font-bold tracking-wider"
                  style={{ color: "var(--primary)" }}
                >
                  STEP {step.num}
                </span>
                <h3 className="text-xl font-semibold mt-3 mb-3">
                  {step.title}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-gradient" aria-hidden="true" />

      {/* Platform features */}
      <section className="py-24 px-6" aria-labelledby="dev-features-heading">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p
              className="text-sm font-medium uppercase tracking-[0.2em] mb-4"
              style={{ color: "var(--primary)" }}
            >
              Built for builders
            </p>
            <h2
              id="dev-features-heading"
              className="text-3xl md:text-5xl font-bold tracking-tight"
            >
              Everything is on-chain and yours
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 stagger">
            {features.map((f) => (
              <div key={f.title} className="card-premium p-8">
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-gradient" aria-hidden="true" />

      {/* Payout chain selector preview */}
      <section className="py-24 px-6" aria-labelledby="payout-heading">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p
              className="text-sm font-medium uppercase tracking-[0.2em] mb-4"
              style={{ color: "var(--primary)" }}
            >
              Preview
            </p>
            <h2
              id="payout-heading"
              className="text-3xl md:text-4xl font-bold tracking-tight mb-3"
            >
              Get paid on the chain you want
            </h2>
            <p
              className="text-base"
              style={{ color: "var(--text-secondary)" }}
            >
              Earn on Sui today. Cross-chain payouts (claim to Base or Solana
              via Wormhole) are on the roadmap.
            </p>
          </div>
          <div
            className="card-premium p-7"
            aria-label="Payout chain options preview"
          >
            <ul className="space-y-3">
              {payoutChains.map((c) => (
                <li
                  key={c.name}
                  className="flex items-center justify-between rounded-xl border px-5 py-4"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                  }}
                >
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Receive in {c.token}
                    </p>
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: c.color }}
                  >
                    {c.status}
                  </span>
                </li>
              ))}
            </ul>
            <p
              className="mt-4 text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              Track this on the{" "}
              <Link href="/roadmap" className="underline">
                public roadmap
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <div className="divider-gradient" aria-hidden="true" />

      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto relative">
          <div
            className="absolute inset-0 rounded-3xl"
            style={{
              background:
                "radial-gradient(ellipse at center, var(--primary-glow) 0%, transparent 70%)",
              filter: "blur(60px)",
              transform: "scale(1.2)",
            }}
            aria-hidden="true"
          />
          <div className="glass-strong rounded-3xl p-12 md:p-20 text-center relative">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5">
              Ready to ship?
            </h2>
            <p
              className="text-lg max-w-xl mx-auto mb-10"
              style={{ color: "var(--text-secondary)" }}
            >
              Create your developer profile and publish your first server
              today.
            </p>
            <Link href="/signup?developer=true">
              <Button variant="primary" size="lg" className="btn-shine">
                Become a developer
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
