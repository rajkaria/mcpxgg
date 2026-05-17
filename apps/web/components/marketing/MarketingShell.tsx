/**
 * S8-T17 — shared marketing chrome (nav + footer) so every marketing page
 * (/about, /pricing, /developers, /security, /roadmap, /status) uses one
 * consistent header and footer instead of each re-implementing the glass nav.
 * Server component; matches the conventions already in app/page.tsx.
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { label: "Marketplace", href: "/marketplace" },
  { label: "Pricing", href: "/pricing" },
  { label: "Developers", href: "/developers" },
  { label: "Roadmap", href: "/roadmap" },
] as const;

const FOOTER_LINKS = {
  Product: [
    { label: "Marketplace", href: "/marketplace" },
    { label: "Pricing", href: "/pricing" },
    { label: "Insurance Pool", href: "/insurance" },
    { label: "Status", href: "/status" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Security", href: "/security" },
    { label: "Roadmap", href: "/roadmap" },
  ],
  Developers: [
    { label: "For Developers", href: "/developers" },
    { label: "Live activity", href: "/live" },
  ],
} as const;

export function MarketingNav({ active }: { active?: string }) {
  return (
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
          {NAV_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm transition-all duration-300 hover:text-[var(--text)]"
              style={{
                color:
                  active === item.label
                    ? "var(--primary)"
                    : "var(--text-muted)",
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Log in
            </Button>
          </Link>
          <Link href="/signup">
            <Button variant="primary" size="sm">
              Get started
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}

export function MarketingFooter() {
  return (
    <footer
      className="py-16 px-6"
      style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Link
              href="/"
              className="text-xl font-bold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              MCPX
            </Link>
            <p
              className="text-sm mt-3 leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              The on-chain marketplace and gateway for MCP servers, settled in
              USDsui on Sui.
            </p>
          </div>
          {Object.entries(FOOTER_LINKS).map(([group, links]) => (
            <div key={group}>
              <h2
                className="text-xs font-semibold uppercase tracking-wider mb-4"
                style={{ color: "var(--text-secondary)" }}
              >
                {group}
              </h2>
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
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Powered by Sui &amp; the x402 payment standard.
          </p>
        </div>
      </div>
    </footer>
  );
}
