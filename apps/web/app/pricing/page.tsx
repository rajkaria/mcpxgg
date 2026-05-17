/**
 * S8-T17 — pricing. USDsui per-call, no credits/subscriptions. Take-rate
 * breakdown: 250bps total = 50bps insurance + 200bps treasury, 9750bps to
 * the developer. All on-chain configurable via PlatformConfig (ADR-004).
 */

import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { MarketingNav, MarketingFooter } from "@/components/marketing/MarketingShell";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Pay per call in USDsui on Sui — no subscriptions, no credits. 2.5% take rate: 0.5% to the insurance pool, 2.0% to the treasury, 97.5% to the developer.",
  alternates: { canonical: "/pricing" },
  openGraph: { url: "/pricing" },
};

const takeRate = [
  {
    label: "Developer vault",
    bps: "9,750 bps",
    pct: "97.5%",
    desc: "Paid straight to the server developer's on-chain Sui vault.",
    color: "var(--success)",
  },
  {
    label: "Protocol treasury",
    bps: "200 bps",
    pct: "2.0%",
    desc: "Funds the gateway, facilitator, indexer, and first-party servers.",
    color: "#60a5fa",
  },
  {
    label: "Insurance pool",
    bps: "50 bps",
    pct: "0.5%",
    desc: "Refunds failed tool calls — fully transparent and on-chain.",
    color: "var(--warning)",
  },
];

const facts = [
  {
    title: "No subscriptions",
    desc: "There is no monthly plan. You fund a session and spend it per call.",
  },
  {
    title: "No credits",
    desc: "Prices are denominated in USDsui smallest units (6 decimals), not an invented credit token.",
  },
  {
    title: "Per-call settlement",
    desc: "Each call debits your session and settles atomically on Sui in one transaction.",
  },
  {
    title: "On-chain configurable",
    desc: "The take rate lives in a PlatformConfig shared object, changeable only via admin multisig.",
  },
];

const faqs = [
  {
    q: "How do I pay?",
    a: "Connect a wallet (or use the embedded Privy wallet) and fund a session in USDsui. Every tool call debits that session and settles on Sui. There is no card on file and no subscription.",
  },
  {
    q: "Who sets the price of a tool call?",
    a: "The server developer sets a per-call price in USDsui atomic units. The marketplace shows it before you call. The 2.5% platform take rate is applied on top, on-chain.",
  },
  {
    q: "What is the take rate exactly?",
    a: "2.5% total, split as 50 bps (0.5%) to the insurance pool and 200 bps (2.0%) to the protocol treasury. The remaining 97.5% goes to the developer's vault. It's configurable on-chain via admin multisig.",
  },
  {
    q: "What happens if a call fails?",
    a: "Failed calls can be refunded from the on-chain insurance pool that the 0.5% slice funds. The pool, every payout, and every contributor are public on the insurance page.",
  },
  {
    q: "How do developers get paid?",
    a: "Earnings accrue to an on-chain vault and can be auto-claimed. There is no Stripe, no weekly batch, no minimum threshold imposed by a payment processor — it's your Sui vault.",
  },
];

export default function PricingPage() {
  return (
    <div
      className="min-h-screen relative"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <MarketingNav active="Pricing" />

      <section className="relative pt-32 pb-16 px-6 text-center overflow-hidden">
        <div
          className="hero-glow-secondary"
          style={{ top: "50px", left: "30%" }}
          aria-hidden="true"
        />
        <div className="relative z-10 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            Pay per call, <span className="text-gradient">in USDsui</span>
          </h1>
          <p
            className="text-lg"
            style={{ color: "var(--text-secondary)" }}
          >
            No subscriptions. No credits. Fund a session, call any server, and
            every call settles on-chain on Sui.
          </p>
        </div>
      </section>

      {/* Take-rate breakdown */}
      <section className="px-6 pb-24" aria-labelledby="take-rate-heading">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p
              className="text-sm font-medium uppercase tracking-[0.2em] mb-3"
              style={{ color: "var(--primary)" }}
            >
              Take rate
            </p>
            <h2
              id="take-rate-heading"
              className="text-3xl font-bold tracking-tight"
            >
              Where every USDsui goes
            </h2>
            <p
              className="mt-3 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              2.5% total platform take rate. 97.5% to the developer. All
              enforced on-chain in a single atomic settlement.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {takeRate.map((t) => (
              <div key={t.label} className="card-premium p-7">
                <div
                  className="inline-flex px-3 py-1 rounded-full text-xs font-bold mb-4"
                  style={{ background: `${t.color}22`, color: t.color }}
                >
                  {t.bps}
                </div>
                <p className="text-3xl font-bold mb-1">{t.pct}</p>
                <h3 className="font-semibold mb-2">{t.label}</h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-gradient" aria-hidden="true" />

      {/* Pricing facts */}
      <section className="py-24 px-6" aria-labelledby="facts-heading">
        <div className="max-w-5xl mx-auto">
          <h2
            id="facts-heading"
            className="text-3xl font-bold tracking-tight text-center mb-12"
          >
            How billing works
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {facts.map((f) => (
              <div key={f.title} className="card-premium p-7">
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

      {/* FAQ */}
      <section className="py-24 px-6" aria-labelledby="faq-heading">
        <div className="max-w-3xl mx-auto">
          <h2
            id="faq-heading"
            className="text-3xl font-bold tracking-tight text-center mb-12"
          >
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="card-premium p-6">
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-gradient" aria-hidden="true" />

      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto relative">
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
          <div className="glass-strong rounded-3xl p-12 text-center relative">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              Start with a $1.00 grant
            </h2>
            <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
              New accounts get a $1.00 USDsui bootstrap grant. Connect a
              wallet — no credit card.
            </p>
            <Link href="/signup">
              <Button variant="primary" size="lg" className="btn-shine">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
