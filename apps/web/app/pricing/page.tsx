import Link from "next/link";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    desc: "Get started with the basics",
    credits: "100 credits/month",
    features: [
      "100 credits per month",
      "All MCP servers accessible",
      "No rollover",
      "Community support",
      "Credits expire monthly",
    ],
    cta: "Get started free",
    ctaHref: "/signup",
    highlight: false,
  },
  {
    name: "Starter",
    price: "₹999",
    period: "/month",
    desc: "For individual developers",
    credits: "1,000 credits/month",
    features: [
      "1,000 credits per month",
      "All MCP servers accessible",
      "Rollover up to 2,000",
      "Priority support",
      "API analytics dashboard",
    ],
    cta: "Start free trial",
    ctaHref: "/signup?plan=starter",
    highlight: true,
  },
  {
    name: "Pro",
    price: "₹1999",
    period: "/month",
    desc: "For teams and power users",
    credits: "5,000 credits/month",
    features: [
      "5,000 credits per month",
      "All MCP servers accessible",
      "Rollover up to 10,000",
      "Dedicated support",
      "Priority API access",
      "Advanced analytics",
    ],
    cta: "Start free trial",
    ctaHref: "/signup?plan=pro",
    highlight: false,
  },
];

const topupPacks = [
  { credits: 500, price: "₹600", perCredit: "₹1.2" },
  { credits: 1000, price: "₹1,200", perCredit: "₹1.2" },
  { credits: 5000, price: "₹6,000", perCredit: "₹1.2", popular: true },
];

const creditExplainer = [
  {
    tier: "Lightweight",
    cost: "1 credit",
    examples: "Status checks, list operations, simple lookups",
    color: "var(--success)",
  },
  {
    tier: "Medium",
    cost: "3 credits",
    examples: "Data retrieval, standard API calls, searches",
    color: "var(--warning)",
  },
  {
    tier: "Heavy",
    cost: "10 credits",
    examples: "AI analysis, web scraping, complex processing",
    color: "var(--error)",
  },
];

const faqs = [
  {
    q: "Can I use any MCP server on any plan?",
    a: "Yes! Every plan gives you access to all MCP servers in the marketplace. Plans differ only in the number of credits you receive each month.",
  },
  {
    q: "What happens when I run out of credits?",
    a: "You can buy a top-up pack at any time, or upgrade to a higher plan. Unused top-up credits last 12 months.",
  },
  {
    q: "Do unused credits expire?",
    a: "Free tier credits reset monthly with no rollover. Starter and Pro credits roll over to the next month (up to 2x your monthly grant). PAYG top-up credits last 12 months.",
  },
  {
    q: "How do payouts work for developers?",
    a: "Developers earn 85% of the credit revenue their tools generate. Payouts are processed weekly via Stripe Connect, with a ₹2,500 minimum threshold.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes! Every account starts with 100 free credits. No credit card required to sign up.",
  },
];

export const metadata = {
  title: "Pricing | MCPX",
  description: "Simple, credit-based pricing. Pay only for what you use.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen relative" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <nav className="nav-glass fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            MCPX
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/marketplace"
              className="text-sm transition-all duration-300 hover:text-[var(--text)]"
              style={{ color: "var(--text-muted)" }}
            >
              Marketplace
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-medium"
              style={{ color: "var(--primary)" }}
            >
              Pricing
            </Link>
            <Link
              href="/developers"
              className="text-sm transition-all duration-300 hover:text-[var(--text)]"
              style={{ color: "var(--text-muted)" }}
            >
              Developers
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button variant="primary" size="sm">Sign up</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-16 px-6 text-center overflow-hidden">
        <div className="hero-glow-secondary" style={{ top: "50px", left: "30%" }} />
        <div className="hero-glow-secondary" style={{ top: "80px", right: "20%", left: "auto" }} />

        <div className="relative z-10">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            Simple, <span className="text-gradient">transparent</span> pricing
          </h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--text-secondary)" }}>
            One account. Access every MCP server. Pay only for what you use.
          </p>
        </div>
      </section>

      {/* Plan Cards */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`${plan.highlight ? "card-premium-highlight" : "card-premium"} relative p-8`}
            >
              {plan.highlight && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-medium"
                  style={{ background: "var(--primary)", color: "#fff" }}
                >
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="text-sm mt-1 mb-4" style={{ color: "var(--text-muted)" }}>
                {plan.desc}
              </p>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {plan.period}
                </span>
              </div>
              <p className="text-sm font-medium mb-6" style={{ color: "var(--primary)" }}>
                {plan.credits}
              </p>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      style={{ color: "var(--success)", flexShrink: 0 }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={plan.ctaHref}>
                <Button
                  variant={plan.highlight ? "primary" : "secondary"}
                  className={`w-full ${plan.highlight ? "btn-shine" : ""}`}
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </section>

      <div className="divider-gradient" />

      {/* PAYG Section */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-medium uppercase tracking-[0.2em] mb-3" style={{ color: "var(--primary)" }}>
              Pay as you go
            </p>
            <h2 className="text-3xl font-bold tracking-tight mb-3">
              Need more credits?
            </h2>
            <p style={{ color: "var(--text-secondary)" }}>
              Top up anytime. Credits last 12 months. No subscription required.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {topupPacks.map((pack) => (
              <div
                key={pack.credits}
                className={`${pack.popular ? "card-premium-highlight" : "card-premium"} relative p-6 text-center`}
              >
                {pack.popular && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-medium"
                    style={{ background: "var(--primary)", color: "#fff" }}
                  >
                    Best value
                  </span>
                )}
                <p className="text-3xl font-bold mb-1">{pack.credits.toLocaleString()}</p>
                <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>credits</p>
                <p className="text-2xl font-bold mb-1">{pack.price}</p>
                <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>
                  {pack.perCredit}/credit
                </p>
                <Link href="/signup">
                  <Button
                    variant={pack.popular ? "primary" : "secondary"}
                    size="sm"
                    className={`w-full ${pack.popular ? "btn-shine" : ""}`}
                  >
                    Buy credits
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-gradient" />

      {/* Credit Cost Explainer */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-medium uppercase tracking-[0.2em] mb-3" style={{ color: "var(--primary)" }}>
              Credit costs
            </p>
            <h2 className="text-3xl font-bold tracking-tight mb-3">
              What do credits cost?
            </h2>
            <p style={{ color: "var(--text-secondary)" }}>
              Tool costs are set by developers and vary by complexity.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {creditExplainer.map((tier) => (
              <div
                key={tier.tier}
                className="card-premium p-6"
              >
                <div
                  className="inline-flex px-3 py-1 rounded-full text-sm font-bold mb-4"
                  style={{ background: tier.color, color: "#000" }}
                >
                  {tier.cost}
                </div>
                <h3 className="font-semibold mb-2">{tier.tier}</h3>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {tier.examples}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-gradient" />

      {/* FAQ */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-medium uppercase tracking-[0.2em] mb-3" style={{ color: "var(--primary)" }}>
              FAQ
            </p>
            <h2 className="text-3xl font-bold tracking-tight">
              Frequently asked questions
            </h2>
          </div>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div
                key={faq.q}
                className="card-premium p-6"
              >
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-gradient" />

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto relative">
          {/* Background glow for CTA */}
          <div
            className="absolute inset-0 rounded-3xl"
            style={{
              background: "radial-gradient(ellipse at center, var(--primary-glow) 0%, transparent 70%)",
              filter: "blur(60px)",
              transform: "scale(1.2)",
            }}
          />
          <div className="glass-strong rounded-3xl p-12 text-center relative">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              Ready to get started?
            </h2>
            <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
              Sign up free and start using MCP servers in minutes.
            </p>
            <Link href="/signup">
              <Button variant="primary" size="lg" className="btn-shine">
                Get started free
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
