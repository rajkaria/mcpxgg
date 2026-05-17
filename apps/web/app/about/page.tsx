/**
 * S8-T17 — about. Mission-first. No credits / no subscriptions language.
 * The x402 + on-chain settlement differentiator is the headline.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { MarketingNav, MarketingFooter } from "@/components/marketing/MarketingShell";

export const metadata: Metadata = {
  title: "About",
  description:
    "MCPX is the on-chain MCP marketplace. Every tool call settles in USDsui on Sui via the open x402 standard — no subscriptions, no credits, permanent receipts.",
  alternates: { canonical: "/about" },
  openGraph: { url: "/about" },
};

export default function AboutPage() {
  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <MarketingNav active="" />

      <main className="max-w-3xl mx-auto px-6 py-24 pt-32">
        <div className="relative">
          <div
            className="hero-glow-secondary"
            style={{ top: "-120px", left: "50%", transform: "translateX(-50%)" }}
            aria-hidden="true"
          />
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8 relative">
            About <span className="text-gradient">MCPX</span>
          </h1>
        </div>

        <div className="space-y-10">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Our mission</h2>
            <p
              className="text-base leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              The Model Context Protocol is how AI assistants reach the real
              world. We're building the marketplace and gateway that makes
              every MCP server discoverable, callable with one key, and paid
              for honestly — with the payment rail built into the protocol
              itself, not bolted on as a billing system.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              What makes MCPX different
            </h2>
            <p
              className="text-base leading-relaxed mb-4"
              style={{ color: "var(--text-secondary)" }}
            >
              Most platforms wrap tools in a subscription or an invented credit
              system. MCPX doesn't. We settle every single tool call on-chain,
              in USDsui, over the open{" "}
              <span style={{ color: "var(--text)" }}>x402 payment standard</span>:
            </p>
            <ul className="space-y-3">
              {[
                "No subscriptions and no credits — you pay per call in USDsui, a stablecoin, from day one",
                "x402 over HTTP: payment is a first-class part of the request, not a separate billing portal",
                "Atomic settlement on Sui in a single transaction — debit, developer payout, treasury, insurance, and receipt all-or-nothing",
                "Permanent, verifiable CallReceipts on Walrus — composable with future trust primitives",
                "Developers earn 97.5% straight to an on-chain Sui vault, no payment processor in the middle",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 text-sm"
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
                    style={{ color: "var(--primary)" }}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">The story</h2>
            <p
              className="text-base leading-relaxed mb-4"
              style={{ color: "var(--text-secondary)" }}
            >
              Connecting AI assistants to real tools was too complicated: every
              server had its own setup, credentials, and billing. The old
              answer was a credit wallet and a card on file. We thought the
              right answer was to make payment native — settle each call
              on-chain, give the user a permanent receipt, and pay the
              developer instantly.
            </p>
            <p
              className="text-base leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              So we rebuilt MCPX Sui-native: a curated on-chain marketplace, a
              gateway that routes and meters every call, and an x402
              facilitator that settles it in USDsui.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">For developers</h2>
            <p
              className="text-base leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              Publish a server and keep 97.5% of every call, paid straight to
              your Sui vault. No payment processor, no minimum threshold, no
              infrastructure to manage. SLA staking and the insurance pool keep
              the marketplace honest for everyone.
            </p>
          </section>

          <section className="relative">
            <div
              className="absolute -inset-8 rounded-3xl opacity-30 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(129, 140, 248, 0.15), transparent 70%)",
              }}
              aria-hidden="true"
            />
            <div className="glass-strong p-8 rounded-2xl relative">
              <h2 className="text-2xl font-semibold mb-3">Get in touch</h2>
              <p
                className="text-sm leading-relaxed mb-4"
                style={{ color: "var(--text-secondary)" }}
              >
                Questions, feedback, or want to partner with us? We'd love to
                hear from you.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="mailto:hello@mcpx.gg">
                  <Button variant="primary" size="sm" className="btn-shine">
                    Email us
                  </Button>
                </Link>
                <Link href="/roadmap">
                  <Button variant="secondary" size="sm">
                    See the roadmap
                  </Button>
                </Link>
                <Link href="/security">
                  <Button variant="secondary" size="sm">
                    Security
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
