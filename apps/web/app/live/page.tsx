import Link from "next/link";
import { getLiveMetrics } from "@/lib/chain/reads";
import { LiveTerminal } from "./live-terminal";

export const metadata = {
  title: "Live | MCPX",
  description:
    "Real-time MCPX activity — every settled tool call, on-chain, as it happens.",
};

export const dynamic = "force-dynamic";

export default async function LivePage() {
  let initial = {
    totalCalls: 0,
    totalSettledAtomic: "0",
    activeServers: 0,
    activeUsers: 0,
    topServers: [] as Array<{
      name: string;
      namespace: string | null;
      calls: number;
    }>,
    activeUserList: [] as Array<{ address: string; calls: number }>,
  };
  try {
    const m = await getLiveMetrics();
    initial = {
      totalCalls: m.totalCalls,
      totalSettledAtomic: m.totalSettledAtomic.toString(),
      activeServers: m.activeServers,
      activeUsers: m.activeUsers,
      topServers: m.topServers,
      activeUserList: m.activeUserList,
    };
  } catch {
    /* mirror unavailable — render zeros, client polling recovers */
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <nav className="nav-glass fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight"
            style={{
              color: "var(--text)",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            MCPX
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/marketplace"
              className="text-sm hover:opacity-80"
              style={{ color: "var(--text-secondary)" }}
            >
              Marketplace
            </Link>
            <Link
              href="/live"
              className="text-sm font-medium"
              style={{ color: "var(--primary)" }}
            >
              Live
            </Link>
            <Link
              href="/developers"
              className="text-sm hover:opacity-80"
              style={{ color: "var(--text-secondary)" }}
            >
              Developers
            </Link>
          </div>
          <Link href="/signup">
            <button
              className="px-4 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              Sign up
            </button>
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 pt-28 pb-12">
        <div className="mb-8">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">
            <span className="text-gradient">Live</span>
          </h1>
          <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
            Every settled MCP call, on-chain, as it happens. Last 24 hours.
          </p>
        </div>
        <LiveTerminal initial={initial} />
      </div>
    </div>
  );
}
