import Link from "next/link";
import { Button } from "@/components/ui/button";

const steps = [
  {
    num: "01",
    title: "Use our starter template",
    desc: "Clone the open-source template, follow the PROMPT.md to build your MCP server with AI assistance. Supports any language or framework.",
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Publish with one config file",
    desc: "Add an mcpx.config.json, paste it in the dashboard, pass our automated quality gates, and your server goes live instantly.",
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Get paid weekly",
    desc: "Earn 85% of all credit revenue your tools generate. Weekly payouts via Stripe Connect with a $25 minimum threshold.",
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const benefits = [
  {
    title: "No billing infrastructure",
    desc: "We handle all user billing, credit tracking, and payment processing. You focus on building great tools.",
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
  {
    title: "Built-in distribution",
    desc: "Your servers are instantly discoverable to every MCPX user. No marketing required — we bring the users to you.",
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
      </svg>
    ),
  },
  {
    title: "Analytics dashboard",
    desc: "Track calls, revenue, user growth, and tool performance. Understand exactly how your servers are being used.",
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    title: "AI-assisted building",
    desc: "Our starter template includes a PROMPT.md that guides AI assistants to help you build your server from scratch.",
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
  },
];

export const metadata = {
  title: "For Developers | MCPX",
  description: "Build MCP servers and earn money on the MCPX marketplace.",
};

export default function DevelopersPage() {
  return (
    <div className="min-h-screen relative" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <nav className="nav-glass fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
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
              className="text-sm transition-all duration-300 hover:text-[var(--text)]"
              style={{ color: "var(--text-muted)" }}
            >
              Pricing
            </Link>
            <Link href="/developers" className="text-sm font-medium" style={{ color: "var(--primary)" }}>
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
      <section className="relative pt-32 pb-24 px-6 text-center overflow-hidden">
        {/* Background glows */}
        <div className="hero-glow" style={{ top: "-200px", left: "50%", transform: "translateX(-50%)" }} />
        <div className="hero-glow-secondary" style={{ top: "100px", left: "20%" }} />
        <div className="hero-glow-secondary" style={{ top: "50px", right: "15%", left: "auto" }} />

        <div className="max-w-4xl mx-auto relative z-10">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 glass"
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--success)" }} />
            <span style={{ color: "var(--text-secondary)" }}>Now accepting developers</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Build MCP servers.
            <br />
            <span className="text-gradient">Earn money.</span>
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Publish in hours, not weeks. Get paid weekly. Earn 85% of every credit your tools generate.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup?developer=true">
              <Button variant="primary" size="lg" className="btn-shine">
                Start building
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="ml-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Button>
            </Link>
            <Link href="https://github.com">
              <Button variant="secondary" size="lg">
                View starter template
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Revenue visual */}
      <section className="pb-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="glass-strong p-8 rounded-2xl text-center">
            <p className="text-sm font-medium uppercase tracking-[0.2em] mb-6" style={{ color: "var(--primary)" }}>
              Revenue model
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <div className="text-center">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Users pay MCPX</p>
                <p className="text-2xl font-bold mt-1">100%</p>
              </div>
              <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: "var(--text-muted)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
              <div className="text-center">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Platform fee</p>
                <p className="text-2xl font-bold mt-1">15%</p>
              </div>
              <span className="text-xl font-bold" style={{ color: "var(--text-muted)" }}>+</span>
              <div className="text-center">
                <p className="text-sm" style={{ color: "var(--success)" }}>You earn</p>
                <p className="text-2xl font-bold mt-1" style={{ color: "var(--success)" }}>85%</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-medium uppercase tracking-[0.2em] mb-4" style={{ color: "var(--primary)" }}>
              How it works
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              From idea to revenue in three steps
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 stagger">
            {steps.map((step) => (
              <div
                key={step.num}
                className="card-premium p-8"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
                  style={{ background: "var(--primary-glow)", color: "var(--primary)" }}
                >
                  {step.icon}
                </div>
                <span
                  className="text-xs font-mono font-bold tracking-wider"
                  style={{ color: "var(--primary)" }}
                >
                  STEP {step.num}
                </span>
                <h3 className="text-xl font-semibold mt-3 mb-3">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform benefits */}
      <div className="divider-gradient" />
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-medium uppercase tracking-[0.2em] mb-4" style={{ color: "var(--primary)" }}>
              Platform benefits
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Everything you need to succeed
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 stagger">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="card-premium p-8"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: "var(--primary-glow)", color: "var(--primary)" }}
                >
                  {b.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{b.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {b.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className="divider-gradient" />

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto relative">
          {/* Background glow for CTA */}
          <div
            className="absolute inset-0 rounded-3xl"
            style={{
              background: "radial-gradient(ellipse at center, var(--primary-glow) 0%, transparent 70%)",
              filter: "blur(60px)",
              transform: "scale(1.2)",
            }}
          />
          <div className="glass-strong rounded-3xl p-12 md:p-20 text-center relative">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5">
              Ready to build?
            </h2>
            <p className="text-lg max-w-xl mx-auto mb-10" style={{ color: "var(--text-secondary)" }}>
              Sign up, create your developer profile, and publish your first server today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup?developer=true">
                <Button variant="primary" size="lg" className="btn-shine">
                  Become a developer
                </Button>
              </Link>
              <Link href="https://github.com">
                <Button variant="secondary" size="lg">
                  Read the docs
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
