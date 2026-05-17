import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { LiveTicker } from "@/components/LiveTicker";
import { EmbedWidget } from "@/components/EmbedWidget";
import { StablecoinFlow } from "@/components/StablecoinFlow";
import { MarketingNav, MarketingFooter } from "@/components/marketing/MarketingShell";
import { ANCHOR_SERVERS } from "@/lib/content/anchor-servers";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

const steps = [
  {
    num: "01",
    title: "Discover",
    desc: "Browse a curated, on-chain registry of MCP servers — data, analytics, identity, DeFi, and more.",
  },
  {
    num: "02",
    title: "Connect",
    desc: "One API key, one gateway URL. Plug into Claude, Cursor, or any MCP-compatible client.",
  },
  {
    num: "03",
    title: "Settle",
    desc: "Every tool call settles atomically in USDsui on Sui — with a permanent receipt you can verify.",
  },
];

const trust = [
  {
    title: "Settled on Sui",
    desc: "Every call is an atomic on-chain settlement. No off-chain ledger to trust.",
  },
  {
    title: "x402 payment standard",
    desc: "Pay-per-call over HTTP via the open x402 spec — no cards, no subscriptions.",
  },
  {
    title: "USDsui only",
    desc: "Stablecoin from day one. Prices in USDsui smallest units, never credits.",
  },
  {
    title: "Permanent receipts",
    desc: "Each CallReceipt and its Walrus blob are permanent and composable.",
  },
];

export default async function LandingPage() {
  return (
    <div
      className="min-h-screen relative"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <MarketingNav active="" />

      {/* ====== HERO ====== */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div
          className="hero-glow"
          style={{ top: "-200px", left: "50%", transform: "translateX(-50%)" }}
          aria-hidden="true"
        />
        <div
          className="hero-glow-secondary"
          style={{ top: "100px", left: "20%" }}
          aria-hidden="true"
        />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="animate-fade-in inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 glass">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "var(--success)" }}
              aria-hidden="true"
            />
            <span style={{ color: "var(--text-secondary)" }}>
              Live on Sui mainnet
            </span>
          </div>

          <h1
            className="animate-fade-in text-5xl sm:text-6xl md:text-7xl font-bold leading-[0.98] tracking-tight mb-6"
            style={{ animationDelay: "100ms" }}
          >
            The on-chain MCP marketplace,
            <br />
            <span className="text-gradient">settled in USDsui.</span>
          </h1>

          <p
            className="animate-fade-in text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: "var(--text-secondary)", animationDelay: "200ms" }}
          >
            One API key for every MCP server. Every tool call settles
            atomically on Sui — no subscriptions, no credits, permanent
            receipts, and developers earn straight to a Sui vault.
          </p>

          {/* Split CTAs: end-users vs developers */}
          <div
            className="animate-fade-in flex flex-col sm:flex-row items-center justify-center gap-4"
            style={{ animationDelay: "300ms" }}
          >
            <Link href="/signup">
              <Button variant="primary" size="lg" className="btn-shine">
                Start using tools
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="ml-2"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </Button>
            </Link>
            <Link href="/developers">
              <Button variant="secondary" size="lg">
                Build &amp; earn as a developer
              </Button>
            </Link>
          </div>

          <div className="animate-fade-in mt-6 flex justify-center">
            <LiveTicker />
          </div>

          <p
            className="animate-fade-in mt-6 text-sm"
            style={{ color: "var(--text-muted)", animationDelay: "400ms" }}
          >
            $1.00 USDsui bootstrap grant &middot; Connect a wallet, no credit
            card
          </p>
        </div>

        {/* Animated stablecoin-flow diagram */}
        <div className="max-w-4xl mx-auto mt-20 animate-fade-in-slow relative z-10">
          <div className="card-premium p-8">
            <p
              className="text-center text-xs font-medium uppercase tracking-[0.2em] mb-6"
              style={{ color: "var(--text-muted)" }}
            >
              One call, one atomic settlement
            </p>
            <StablecoinFlow />
          </div>
        </div>

        <div className="divider-gradient mt-24" aria-hidden="true" />
      </section>

      {/* ====== POWERED BY TRUST STRIP ====== */}
      <section className="py-16 px-6" aria-labelledby="trust-heading">
        <div className="max-w-6xl mx-auto">
          <p
            id="trust-heading"
            className="text-center text-sm font-medium uppercase tracking-[0.2em] mb-10"
            style={{ color: "var(--text-muted)" }}
          >
            Powered by Sui + x402
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {trust.map((t) => (
              <div key={t.title} className="card-premium p-6">
                <h3 className="text-base font-semibold mb-1.5">{t.title}</h3>
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

      {/* ====== HOW IT WORKS ====== */}
      <section className="py-24 px-6" aria-labelledby="how-heading">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p
              className="text-sm font-medium uppercase tracking-[0.2em] mb-4"
              style={{ color: "var(--primary)" }}
            >
              How it works
            </p>
            <h2
              id="how-heading"
              className="text-3xl md:text-5xl font-bold tracking-tight"
            >
              Three steps to{" "}
              <span className="text-gradient">on-chain tool calls</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 stagger">
            {steps.map((step) => (
              <div
                key={step.num}
                className="card-premium p-8 animate-fade-in-slow"
              >
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

      {/* ====== ANCHOR SERVERS ====== */}
      <section
        className="py-24 px-6 relative overflow-hidden"
        aria-labelledby="anchors-heading"
      >
        <div
          className="hero-glow-secondary"
          style={{ top: "50%", left: "-200px", transform: "translateY(-50%)" }}
          aria-hidden="true"
        />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <p
              className="text-sm font-medium uppercase tracking-[0.2em] mb-4"
              style={{ color: "var(--primary)" }}
            >
              First-party servers
            </p>
            <h2
              id="anchors-heading"
              className="text-3xl md:text-5xl font-bold tracking-tight"
            >
              Five anchor servers,{" "}
              <span className="text-gradient">live today</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger">
            {ANCHOR_SERVERS.map((s) => (
              <Link
                key={s.namespace}
                href={`/marketplace/${s.namespace}`}
                className="card-premium p-7 animate-fade-in-slow block transition-transform hover:-translate-y-0.5"
              >
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4"
                  style={{ background: `${s.color}20`, color: s.color }}
                >
                  {s.category}
                </span>
                <h3 className="text-lg font-semibold mb-2">{s.name}</h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {s.tagline}
                </p>
                <code
                  className="mt-4 block text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {s.namespace}
                </code>
              </Link>
            ))}
            <Link
              href="/marketplace"
              className="card-premium p-7 animate-fade-in-slow flex flex-col items-start justify-center"
            >
              <h3 className="text-lg font-semibold mb-2">
                Browse the full marketplace
              </h3>
              <p
                className="text-sm leading-relaxed mb-4"
                style={{ color: "var(--text-secondary)" }}
              >
                Every published server, ranked by on-chain quality
                attestations.
              </p>
              <span
                className="text-sm font-medium inline-flex items-center gap-2"
                style={{ color: "var(--primary)" }}
              >
                Explore servers
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </span>
            </Link>
          </div>
        </div>
      </section>

      <div className="divider-gradient" aria-hidden="true" />

      {/* ====== INSURANCE POOL TRANSPARENCY ====== */}
      <section className="py-24 px-6" aria-labelledby="insurance-heading">
        <div className="max-w-5xl mx-auto">
          <div className="card-premium p-10 md:p-12">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <p
                  className="text-sm font-medium uppercase tracking-[0.2em] mb-4"
                  style={{ color: "var(--primary)" }}
                >
                  Built-in insurance
                </p>
                <h2
                  id="insurance-heading"
                  className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
                >
                  A failed call?{" "}
                  <span className="text-gradient">You get refunded.</span>
                </h2>
                <p
                  className="text-base leading-relaxed mb-6"
                  style={{ color: "var(--text-secondary)" }}
                >
                  0.5% of every settled call funds an on-chain insurance pool
                  that refunds failed tool calls. The pool balance, every
                  payout, and every contributor are fully transparent — it's
                  all a mirror of Sui chain state.
                </p>
                <Link href="/insurance">
                  <Button variant="secondary">
                    See the live pool
                    <svg
                      width="16"
                      height="16"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      className="ml-2"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                      />
                    </svg>
                  </Button>
                </Link>
              </div>
              <ul className="space-y-4">
                {[
                  "2.5% total take rate, on-chain configurable",
                  "0.5% to the insurance pool",
                  "2.0% to the protocol treasury",
                  "97.5% to the developer's vault",
                ].map((row) => (
                  <li
                    key={row}
                    className="flex items-center gap-3 text-sm"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      style={{ color: "var(--success)", flexShrink: 0 }}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    {row}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className="divider-gradient" aria-hidden="true" />

      {/* ====== EMBED ANYWHERE ====== */}
      <section className="py-24 px-6" aria-labelledby="embed-heading">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2
              id="embed-heading"
              className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
            >
              Embed it <span className="text-gradient">anywhere</span>
            </h2>
            <p
              className="text-lg max-w-xl mx-auto"
              style={{ color: "var(--text-secondary)" }}
            >
              One script tag, one element. Drop a live, on-chain-settled MCP
              tool call into any page. The widget below is the real thing.
            </p>
          </div>
          <div className="max-w-md mx-auto">
            <EmbedWidget
              server="walrus-search"
              tool="query"
              prefill={{ q: "sui move" }}
              label="Search Walrus"
            />
          </div>
        </div>
      </section>

      <div className="divider-gradient" aria-hidden="true" />

      {/* ====== DEVELOPER CTA ====== */}
      <section className="py-24 px-6" aria-labelledby="dev-cta-heading">
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
            <h2
              id="dev-cta-heading"
              className="text-3xl md:text-5xl font-bold tracking-tight mb-5"
            >
              Build MCP servers.
              <br />
              <span className="text-gradient">Earn in USDsui.</span>
            </h2>
            <p
              className="text-lg max-w-xl mx-auto mb-10"
              style={{ color: "var(--text-secondary)" }}
            >
              Publish your tools and keep 97.5% of every call, paid straight
              to your Sui vault. We handle settlement, hosting, and
              distribution.
            </p>
            <Link href="/developers">
              <Button variant="primary" size="lg" className="btn-shine">
                Start building
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="ml-2"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
