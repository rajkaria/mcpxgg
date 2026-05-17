/**
 * S8-T17 — security. The on-chain surface: Move module list, audit status
 * (submitted to OtterSec, in review), and the admin multisig model. Static,
 * honest, no fabricated certifications.
 */

import type { Metadata } from "next";
import { MarketingNav, MarketingFooter } from "@/components/marketing/MarketingShell";

export const metadata: Metadata = {
  title: "Security",
  description:
    "MCPX security posture: the Move package modules, third-party audit status (submitted to OtterSec, in review), and the admin multisig that governs configurable parameters.",
  alternates: { canonical: "/security" },
  openGraph: { url: "/security" },
};

const modules: Array<{ name: string; role: string }> = [
  { name: "registry", role: "Server registry: publish, update, deactivate." },
  { name: "session", role: "User sessions: funded balance and spend caps." },
  {
    name: "settlement",
    role: "Atomic per-call settlement PTB and CallReceipt mint.",
  },
  { name: "vault", role: "Per-developer earnings vault with auto-claim." },
  { name: "treasury", role: "Protocol treasury (2.0% take-rate slice)." },
  {
    name: "insurance",
    role: "Insurance pool (0.5% slice) and failed-call refunds.",
  },
  { name: "access", role: "Scoped API keys and key rebinding." },
  { name: "quality", role: "Quality oracle attestations per server." },
  { name: "intent", role: "Spending intents: per-call caps and categories." },
  { name: "staking", role: "SLA staking with automatic slashing." },
  { name: "bundle", role: "Composable server bundles and bundle pricing." },
  { name: "admin", role: "Privileged config changes, multisig-gated." },
  { name: "events", role: "Typed events the indexer mirrors off-chain." },
];

const principles = [
  {
    title: "All-or-nothing settlement",
    desc: "Debit, developer payout, treasury, insurance, and receipt mint happen in a single Sui transaction. A partial settlement is impossible.",
  },
  {
    title: "Chain is the source of truth",
    desc: "Postgres is a read-only indexer mirror. The website never writes state that should come from a Move event — it can only fall behind, never lie.",
  },
  {
    title: "No bypass of the facilitator",
    desc: "The gateway never signs settlement itself; it always goes through the x402 facilitator's /settle, so the payment path is auditable in one place.",
  },
  {
    title: "Configurable, not arbitrary",
    desc: "The take rate and other parameters live in a PlatformConfig shared object, mutable only by the admin multisig — not by any single key or server.",
  },
];

export default function SecurityPage() {
  return (
    <div
      className="min-h-screen relative"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <MarketingNav active="" />

      <main className="max-w-4xl mx-auto px-6 pt-32 pb-24">
        <header className="relative mb-14">
          <div
            className="hero-glow-secondary"
            style={{ top: "-120px", left: "50%", transform: "translateX(-50%)" }}
            aria-hidden="true"
          />
          <p
            className="text-sm font-medium uppercase tracking-[0.2em] mb-4 relative"
            style={{ color: "var(--primary)" }}
          >
            Security
          </p>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight relative">
            Trust, but <span className="text-gradient">verify on-chain</span>
          </h1>
          <p
            className="mt-5 text-lg max-w-2xl relative"
            style={{ color: "var(--text-secondary)" }}
          >
            MCPX's money path is a single Move package on Sui. Here's exactly
            what's on-chain, its audit status, and who can change what.
          </p>
        </header>

        {/* Audit status */}
        <section className="mb-16" aria-labelledby="audit-heading">
          <div className="card-premium p-8">
            <h2
              id="audit-heading"
              className="text-2xl font-semibold mb-2"
            >
              Audit status
            </h2>
            <div className="flex items-center gap-3 mb-4">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: "var(--warning)" }}
                aria-hidden="true"
              />
              <span
                className="text-sm font-medium"
                style={{ color: "var(--warning)" }}
              >
                Submitted to OtterSec — in review
              </span>
            </div>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              The full Move source, a written threat model, and a test
              coverage report have been submitted to OtterSec for a
              third-party audit. Findings will be triaged and patched on a
              dedicated branch; this page will be updated with the final
              report when the review completes. No certification is claimed
              until then.
            </p>
          </div>
        </section>

        {/* Move modules */}
        <section className="mb-16" aria-labelledby="modules-heading">
          <h2
            id="modules-heading"
            className="text-2xl font-semibold mb-6"
          >
            Move package modules
          </h2>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-sm">
              <caption className="sr-only">
                The Move modules in the MCPX on-chain package and their roles.
              </caption>
              <thead>
                <tr
                  className="text-left"
                  style={{ color: "var(--text-muted)" }}
                >
                  <th scope="col" className="p-3 font-medium">
                    Module
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    Responsibility
                  </th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <tr
                    key={m.name}
                    className="border-t border-[var(--border)]"
                  >
                    <td className="p-3 font-mono whitespace-nowrap">
                      mcpx::{m.name}
                    </td>
                    <td
                      className="p-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {m.role}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Admin multisig */}
        <section className="mb-16" aria-labelledby="multisig-heading">
          <h2
            id="multisig-heading"
            className="text-2xl font-semibold mb-4"
          >
            Admin multisig
          </h2>
          <p
            className="text-sm leading-relaxed mb-4"
            style={{ color: "var(--text-secondary)" }}
          >
            Privileged operations — changing the take rate, pausing a server,
            rotating the quality oracle key — are gated by{" "}
            <code className="text-xs">mcpx::admin</code> and require an admin
            multisig signature. No single key can change protocol economics.
            There is no upgrade path that silently re-points settlement away
            from the published modules.
          </p>
        </section>

        {/* Principles */}
        <section aria-labelledby="principles-heading">
          <h2
            id="principles-heading"
            className="text-2xl font-semibold mb-6"
          >
            Design principles
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {principles.map((p) => (
              <div key={p.title} className="card-premium p-7">
                <h3 className="text-lg font-semibold mb-2">{p.title}</h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
