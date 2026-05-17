import Link from "next/link";
import {
  listMarketplaceServers,
  listCurrentFeatured,
  listStakedServerIds,
} from "@/lib/chain/reads";
import { MarketplaceClient } from "./marketplace-client";

const categories = [
  "All",
  "Intelligence",
  "Analytics",
  "Code Tools",
  "Data",
  "Communication",
  "Productivity",
  "Security",
  "DevOps",
];

export const metadata = {
  title: "Marketplace | MCPX",
  description: "Browse and enable MCP servers for your AI workflows.",
};

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    staked?: string;
  }>;
}) {
  const params = await searchParams;

  // S4-T12: read the indexer mirror (marketplace_servers view), not chain RPC.
  const all = await listMarketplaceServers();
  // S7-T12: serverObjectIds that currently have a funded stake.
  let stakedIds = new Set<string>();
  try {
    stakedIds = await listStakedServerIds();
  } catch {
    stakedIds = new Set();
  }
  const stakedOnly = params.staked === "1";
  // S6-T25: app-owned featured rotation (read-only here).
  let featuredIds: string[] = [];
  try {
    const feat = await listCurrentFeatured();
    featuredIds = feat
      .sort((a, b) => a.position - b.position)
      .map((f) => f.serverObjectId);
  } catch {
    featuredIds = [];
  }
  const q = params.q?.toLowerCase();
  const filtered = all.filter((s) => {
    if (stakedOnly && !stakedIds.has(s.objectId)) {
      return false;
    }
    if (
      params.category &&
      params.category !== "All" &&
      s.category.toLowerCase() !== params.category.toLowerCase()
    ) {
      return false;
    }
    if (q) {
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.namespace.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const featuredRank = new Map(featuredIds.map((id, i) => [id, i]));
  // Featured-first ordering when no explicit search/sort is applied.
  const ordered =
    featuredIds.length && !q && !params.sort
      ? [...filtered].sort((a, b) => {
          const ra = featuredRank.get(a.objectId) ?? Infinity;
          const rb = featuredRank.get(b.objectId) ?? Infinity;
          return ra - rb;
        })
      : filtered;

  // Map view rows into the shape MarketplaceClient renders.
  const servers = ordered.map((s) => ({
    id: s.objectId,
    name: s.name,
    namespace: s.namespace,
    description: s.description,
    category: s.category,
    total_users: s.toolCount,
    avg_rating: 0,
    icon_url: null,
    status: "active",
    created_at: "",
    quality_score_x100: s.qualityScoreX100,
    featured: featuredRank.has(s.objectId),
    staked: stakedIds.has(s.objectId),
  }));

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <nav className="nav-glass fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight"
            style={{ color: "var(--text)", fontFamily: "var(--font-dm-sans)" }}
          >
            MCPX
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/marketplace" className="text-sm font-medium" style={{ color: "var(--primary)" }}>
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
              <button
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: "var(--text-secondary)" }}
              >
                Log in
              </button>
            </Link>
            <Link href="/signup">
              <button
                className="px-4 py-1.5 rounded-lg text-sm font-medium"
                style={{ background: "var(--primary)", color: "#fff" }}
              >
                Sign up
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-12">
        {/* Page title */}
        <div className="mb-10">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">
            <span className="text-gradient">Marketplace</span>
          </h1>
          <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
            Discover and enable MCP servers for your AI workflows.
          </p>
        </div>

        <MarketplaceClient
          initialServers={(servers as any) || []}
          categories={categories}
          initialQuery={params.q || ""}
          initialCategory={params.category || "All"}
          initialSort={params.sort || "popular"}
          initialStakedOnly={stakedOnly}
        />
      </div>
    </div>
  );
}
