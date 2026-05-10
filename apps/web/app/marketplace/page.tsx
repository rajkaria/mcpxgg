import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
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
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("mcp_servers")
    .select("*")
    .eq("status", "active");

  if (params.q) {
    query = query.or(
      `name.ilike.%${params.q}%,description.ilike.%${params.q}%,namespace.ilike.%${params.q}%`
    );
  }

  if (params.category && params.category !== "All") {
    query = query.eq("category", params.category);
  }

  switch (params.sort) {
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "rating":
      query = query.order("avg_rating", { ascending: false });
      break;
    case "popular":
    default:
      query = query.order("total_users", { ascending: false });
      break;
  }

  const { data: servers } = await query;

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
        />
      </div>
    </div>
  );
}
