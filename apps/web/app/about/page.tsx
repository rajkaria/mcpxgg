import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "About | MCPX",
  description: "The marketplace and unified gateway for MCP servers.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <nav className="nav-glass fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
            MCPX
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/marketplace" className="text-sm hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
              Marketplace
            </Link>
            <Link href="/pricing" className="text-sm hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
              Pricing
            </Link>
            <Link href="/developers" className="text-sm hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
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

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-24 pt-32">
        <div className="relative">
          <div className="hero-glow-secondary" style={{ top: "-120px", left: "50%", transform: "translateX(-50%)" }} />
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8 relative">
            About <span className="text-gradient">MCPX</span>
          </h1>
        </div>

        <div className="space-y-8">
          {/* Mission */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">Our Mission</h2>
            <p className="text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              MCPX exists to make AI tools accessible. We believe the Model Context Protocol is the
              future of how AI assistants interact with the world, and we are building the infrastructure
              to make that future a reality. One account, one API key, every MCP server.
            </p>
          </section>

          {/* What we do */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">What We Do</h2>
            <p className="text-base leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
              MCPX is the marketplace and unified gateway for MCP servers. We provide:
            </p>
            <ul className="space-y-3">
              {[
                "A curated marketplace of MCP-compatible servers for AI workflows",
                "A unified gateway that routes tool calls to the right server automatically",
                "Credit-based billing so users only pay for what they use",
                "A developer platform where builders publish tools and earn revenue",
                "Enterprise-grade infrastructure with authentication and access controls",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="mt-0.5 shrink-0"
                    style={{ color: "var(--primary)" }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* The story */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">The Story</h2>
            <p className="text-base leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
              MCPX started from a simple frustration: connecting AI assistants to real-world tools was
              too complicated. Every server had its own setup process, credentials, configuration format,
              and billing system. We thought: what if there was one place to find, enable, and pay for
              all of them?
            </p>
            <p className="text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              So we built MCPX &mdash; a marketplace where MCP servers live, a gateway that connects them
              all, and a developer platform where builders can earn money for the tools they create.
            </p>
          </section>

          {/* For developers */}
          <section>
            <h2 className="text-2xl font-semibold mb-4">For Developers</h2>
            <p className="text-base leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              We believe developers should be rewarded for building great tools. MCPX gives you built-in
              distribution, handles all billing and payment processing, and pays you 85% of the revenue
              your servers generate. Weekly payouts, no infrastructure to manage.
            </p>
          </section>

          {/* Contact */}
          <section className="relative">
            <div
              className="absolute -inset-8 rounded-3xl opacity-30 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse at center, rgba(129, 140, 248, 0.15), transparent 70%)",
              }}
            />
            <div className="glass-strong p-8 rounded-2xl relative">
              <h2 className="text-2xl font-semibold mb-3">Get in Touch</h2>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
                Have questions, feedback, or want to partner with us? We would love to hear from you.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="mailto:hello@mcpx.gg">
                  <Button variant="primary" size="sm" className="btn-shine">
                    Email us
                  </Button>
                </Link>
                <Link href="https://twitter.com">
                  <Button variant="secondary" size="sm">
                    Follow on X
                  </Button>
                </Link>
                <Link href="https://github.com">
                  <Button variant="secondary" size="sm">
                    GitHub
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
