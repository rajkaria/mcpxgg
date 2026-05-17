import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LiveTicker } from "@/components/LiveTicker";

const steps = [
  {
    num: "01",
    title: "Discover",
    desc: "Browse a curated marketplace of MCP servers — intelligence, analytics, code tools, and more.",
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Enable",
    desc: "One click to activate any server. No config files, no Docker, no infrastructure.",
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.636 5.636a9 9 0 1012.728 0M12 3v9" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Connect",
    desc: "One API key. Every server. Plug into Claude, Cursor, or any MCP-compatible client.",
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.868-2.122l4.5-4.5a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
  },
];

const stats = [
  { value: "50+", label: "MCP Servers" },
  { value: "10K+", label: "API Calls/Day" },
  { value: "99.9%", label: "Uptime" },
  { value: "85%", label: "Developer Share" },
];

const benefits = [
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "One key for everything",
    desc: "Stop juggling credentials. A single API key connects you to every server in the marketplace.",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "Pay only for what you use",
    desc: "Per-call settlement in USDsui from your wallet — no subscriptions, no idle infrastructure, no lock-in.",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: "Enterprise-grade security",
    desc: "Encrypted connections, fine-grained access controls, and SOC 2 compliant infrastructure.",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
    title: "Developer-first",
    desc: "Build and publish MCP servers. Earn 85% of the revenue your tools generate.",
  },
];

const integrations = [
  { name: "Claude Desktop", icon: "C" },
  { name: "Cursor", icon: "Cu" },
  { name: "Windsurf", icon: "W" },
  { name: "VS Code", icon: "VS" },
  { name: "Cline", icon: "Cl" },
  { name: "Any MCP Client", icon: "+" },
];

const testimonials = [
  {
    quote: "MCPX cut our integration time from days to minutes. One API key and we had access to 30+ tools instantly.",
    name: "Arjun Mehta",
    role: "CTO, Buildfast AI",
    initials: "AM",
  },
  {
    quote: "I published my first MCP server and had my first payout within a week. The developer experience is incredible.",
    name: "Priya Sharma",
    role: "Indie Developer",
    initials: "PS",
  },
  {
    quote: "The unified gateway means our AI agents can discover and use new tools without any code changes on our end.",
    name: "Rahul Verma",
    role: "Lead Engineer, NexusAI",
    initials: "RV",
  },
];

const useCases = [
  {
    category: "Intelligence",
    title: "Competitive Analysis",
    desc: "Track competitor pricing, features, and market movements in real-time with Watchdog.",
    color: "#818cf8",
  },
  {
    category: "Analytics",
    title: "Revenue Insights",
    desc: "Get instant revenue breakdowns, churn analysis, and forecasts with Pulse.",
    color: "#34d399",
  },
  {
    category: "Social",
    title: "Brand Monitoring",
    desc: "Scan social mentions, track sentiment, and generate reply drafts with Sonar.",
    color: "#fbbf24",
  },
];

const plans = [
  {
    name: "Pay per call",
    price: "USDsui",
    desc: "Settle each tool call on-chain",
    features: [
      "No subscription — recharge your wallet",
      "Set per-call & daily spend caps",
      "Every call gets an on-chain receipt",
    ],
    highlight: true,
  },
  {
    name: "Free tier",
    price: "$1.00",
    desc: "On the house to start",
    features: [
      "$1.00 USDsui bootstrap grant",
      "First N calls per tool are free",
      "No credit card, just a wallet",
    ],
    highlight: false,
  },
  {
    name: "Developers",
    price: "97.5%",
    desc: "Your share of every call",
    features: [
      "Earn USDsui straight to your vault",
      "2.5% platform take rate",
      "Publish with one command",
    ],
    highlight: false,
  },
];

const footerLinks = {
  Product: [
    { label: "Marketplace", href: "/marketplace" },
    { label: "Pricing", href: "/pricing" },
  ],
  Company: [
    { label: "About", href: "/about" },
  ],
  Developers: [
    { label: "For Developers", href: "/developers" },
  ],
};

export default function LandingPage() {
  return (
    <div className="min-h-screen relative" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Navigation */}
      <nav className="nav-glass fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
            MCPX
          </Link>
          <div className="hidden md:flex items-center gap-8">
            {["Marketplace", "Pricing", "Developers"].map((item) => (
              <Link
                key={item}
                href={`/${item.toLowerCase()}`}
                className="text-sm transition-all duration-300 hover:text-[var(--text)]"
                style={{ color: "var(--text-muted)" }}
              >
                {item}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button variant="primary" size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ====== HERO ====== */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="hero-glow" style={{ top: "-200px", left: "50%", transform: "translateX(-50%)" }} />
        <div className="hero-glow-secondary" style={{ top: "100px", left: "20%" }} />
        <div className="hero-glow-secondary" style={{ top: "50px", right: "15%", left: "auto" }} />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="animate-fade-in inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 glass">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--success)" }} />
            <span style={{ color: "var(--text-secondary)" }}>Now in public beta</span>
          </div>

          <h1
            className="animate-fade-in text-5xl sm:text-6xl md:text-8xl font-bold leading-[0.95] tracking-tight mb-6"
            style={{ animationDelay: "100ms" }}
          >
            Every MCP server.
            <br />
            <span className="text-gradient">One account.</span>
          </h1>

          <p
            className="animate-fade-in text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: "var(--text-secondary)", animationDelay: "200ms" }}
          >
            The marketplace and unified gateway for Model Context Protocol servers.
            Browse, enable, and connect to any MCP tool with a single API key.
          </p>

          <div className="animate-fade-in flex flex-col sm:flex-row items-center justify-center gap-4" style={{ animationDelay: "300ms" }}>
            <Link href="/signup">
              <Button variant="primary" size="lg" className="btn-shine">
                Get started free
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="ml-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="secondary" size="lg">Browse marketplace</Button>
            </Link>
          </div>

          <div className="animate-fade-in mt-6 flex justify-center">
            <LiveTicker />
          </div>

          <p className="animate-fade-in mt-6 text-sm" style={{ color: "var(--text-muted)", animationDelay: "400ms" }}>
            $1.00 USDsui bootstrap grant &middot; Connect a wallet, no credit card
          </p>
        </div>

        {/* Terminal / Code Preview */}
        <div className="max-w-3xl mx-auto mt-20 animate-fade-in-slow relative z-10">
          <div className="card-premium overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="w-3 h-3 rounded-full" style={{ background: "#ef4444" }} />
              <div className="w-3 h-3 rounded-full" style={{ background: "#f59e0b" }} />
              <div className="w-3 h-3 rounded-full" style={{ background: "#22c55e" }} />
              <span className="ml-3 text-xs font-mono" style={{ color: "var(--text-muted)" }}>claude-desktop-config.json</span>
            </div>
            <pre className="p-6 text-sm leading-relaxed overflow-x-auto" style={{ fontFamily: "var(--font-jetbrains-mono), monospace", color: "var(--text-secondary)" }}>
              <code>{`{
  "mcpServers": {
    "mcpx": {
      "url": "https://mcp.mcpx.gg/mcp",
      "headers": {
        "Authorization": "Bearer mcpx_sk_your_key_here"
      }
    }
  }
}`}</code>
            </pre>
          </div>
          <p className="text-center mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
            Add one config. Access every MCP server in the marketplace.
          </p>
        </div>

        <div className="divider-gradient mt-24" />
      </section>

      {/* ====== STATS BAR ====== */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center animate-fade-in">
              <div className="text-4xl md:text-5xl font-bold number-highlight text-gradient">{stat.value}</div>
              <div className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ====== COMPATIBLE CLIENTS ====== */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] mb-8" style={{ color: "var(--text-muted)" }}>
            Works with your favorite AI tools
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {integrations.map((client) => (
              <div
                key={client.name}
                className="card-premium flex items-center gap-3 px-5 py-3"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{ background: "var(--primary-glow)", color: "var(--primary)" }}
                >
                  {client.icon}
                </div>
                <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  {client.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-gradient" />

      {/* ====== HOW IT WORKS ====== */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-sm font-medium uppercase tracking-[0.2em] mb-4" style={{ color: "var(--primary)" }}>
              How it works
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Three steps to <span className="text-gradient">MCP superpowers</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 stagger">
            {steps.map((step, i) => (
              <div key={step.num} className="card-premium p-8 animate-fade-in-slow">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
                  style={{ background: "var(--primary-glow)", color: "var(--primary)" }}
                >
                  {step.icon}
                </div>
                <span className="text-xs font-mono font-bold tracking-wider" style={{ color: "var(--primary)" }}>
                  STEP {step.num}
                </span>
                <h3 className="text-xl font-semibold mt-3 mb-3">{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {step.desc}
                </p>
                {/* Connector line for non-last */}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute -right-3 top-1/2 w-6 h-px" style={{ background: "var(--border)" }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-gradient" />

      {/* ====== USE CASES ====== */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="hero-glow-secondary" style={{ top: "50%", left: "-200px", transform: "translateY(-50%)" }} />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <p className="text-sm font-medium uppercase tracking-[0.2em] mb-4" style={{ color: "var(--primary)" }}>
              Use cases
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              What you can <span className="text-gradient">build with MCPX</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 stagger">
            {useCases.map((uc) => (
              <div key={uc.title} className="card-premium p-8 animate-fade-in-slow">
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-5"
                  style={{ background: `${uc.color}20`, color: uc.color }}
                >
                  {uc.category}
                </span>
                <h3 className="text-xl font-semibold mb-3">{uc.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {uc.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/marketplace">
              <Button variant="secondary" size="lg">
                Explore all servers
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="ml-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="divider-gradient" />

      {/* ====== WHY MCPX ====== */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-sm font-medium uppercase tracking-[0.2em] mb-4" style={{ color: "var(--primary)" }}>
              Why MCPX
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Built for the <span className="text-gradient">MCP ecosystem</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 stagger">
            {benefits.map((b) => (
              <div key={b.title} className="card-premium p-8 animate-fade-in-slow">
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

      {/* ====== TESTIMONIALS ====== */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="hero-glow-secondary" style={{ top: "50%", right: "-200px", transform: "translateY(-50%)", left: "auto" }} />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <p className="text-sm font-medium uppercase tracking-[0.2em] mb-4" style={{ color: "var(--primary)" }}>
              Testimonials
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Loved by <span className="text-gradient">developers</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 stagger">
            {testimonials.map((t) => (
              <div key={t.name} className="card-premium p-8 animate-fade-in-slow">
                {/* Stars */}
                <div className="flex gap-1 mb-5">
                  {[1,2,3,4,5].map((s) => (
                    <svg key={s} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--warning)" }}>
                      <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold"
                    style={{ background: "var(--primary-glow)", color: "var(--primary)" }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-gradient" />

      {/* ====== API PREVIEW ====== */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] mb-4" style={{ color: "var(--primary)" }}>
                Gateway API
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
                One endpoint.
                <br />
                <span className="text-gradient">Every tool.</span>
              </h2>
              <p className="text-base leading-relaxed mb-6" style={{ color: "var(--text-secondary)" }}>
                Send standard MCP requests to a single gateway URL. MCPX routes your tool calls
                to the right server, handles auth, settles the call on-chain in USDsui, and returns results — all in one round trip.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Standard JSON-RPC over HTTP",
                  "Auto-discovery via mcpx_discover",
                  "Sub-200ms response times",
                  "Built-in rate limiting & retries",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: "var(--success)", flexShrink: 0 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/developers">
                <Button variant="secondary">
                  Read the docs
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="ml-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Button>
              </Link>
            </div>
            <div className="card-premium overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                <div className="w-3 h-3 rounded-full" style={{ background: "#ef4444" }} />
                <div className="w-3 h-3 rounded-full" style={{ background: "#f59e0b" }} />
                <div className="w-3 h-3 rounded-full" style={{ background: "#22c55e" }} />
                <span className="ml-3 text-xs font-mono" style={{ color: "var(--text-muted)" }}>POST /mcp</span>
              </div>
              <pre className="p-6 text-xs leading-relaxed overflow-x-auto" style={{ fontFamily: "var(--font-jetbrains-mono), monospace", color: "var(--text-secondary)" }}>
                <code>{`// Call any tool through the gateway
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "watchdog_track",
    "arguments": {
      "url": "https://competitor.com/pricing",
      "label": "Competitor Pricing",
      "check_interval": "6h"
    }
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "Now tracking competitor.com/pricing
             every 6 hours. You'll be notified
             of any changes."
    }]
  }
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      <div className="divider-gradient" />

      {/* ====== PRICING ====== */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-sm font-medium uppercase tracking-[0.2em] mb-4" style={{ color: "var(--primary)" }}>
              Pricing
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Simple, <span className="text-gradient">usage-based</span> pricing
            </h2>
            <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
              Pay per call in USDsui. No subscriptions. Earn directly to your wallet.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 stagger">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`${plan.highlight ? "card-premium-highlight" : "card-premium"} p-8 animate-fade-in-slow`}
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
                <p className="text-sm mt-1 mb-6" style={{ color: "var(--text-muted)" }}>{plan.desc}</p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-5xl font-bold tracking-tight">{plan.price}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm" style={{ color: "var(--text-secondary)" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: "var(--success)", flexShrink: 0 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/pricing">
                  <Button variant={plan.highlight ? "primary" : "secondary"} className={`w-full ${plan.highlight ? "btn-shine" : ""}`}>
                    {plan.highlight ? "Start free trial" : "Get started"}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider-gradient" />

      {/* ====== DEVELOPER CTA ====== */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto relative">
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
              Build MCP servers.
              <br />
              <span className="text-gradient">Earn money.</span>
            </h2>
            <p className="text-lg max-w-xl mx-auto mb-10" style={{ color: "var(--text-secondary)" }}>
              Publish your tools on the MCPX marketplace and earn 85% of the revenue they generate.
              We handle billing, hosting, and distribution.
            </p>
            <Link href="/developers">
              <Button variant="primary" size="lg" className="btn-shine">
                Start building
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="ml-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="py-16 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <Link href="/" className="text-xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
                MCPX
              </Link>
              <p className="text-sm mt-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                The marketplace and gateway
                <br />for MCP servers.
              </p>
            </div>
            {Object.entries(footerLinks).map(([group, links]) => (
              <div key={group}>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-secondary)" }}>
                  {group}
                </h4>
                <ul className="space-y-3">
                  {links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm transition-colors duration-300 hover:text-[var(--text)]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="divider-gradient" />
          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              &copy; {new Date().getFullYear()} MCPX. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link href="https://twitter.com" className="transition-all duration-300 hover:text-[var(--text)]" style={{ color: "var(--text-muted)" }}>
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </Link>
              <Link href="https://github.com" className="transition-all duration-300 hover:text-[var(--text)]" style={{ color: "var(--text-muted)" }}>
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
