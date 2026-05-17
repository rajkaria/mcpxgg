import Link from "next/link";
import { listBundles, type BundleRow } from "@/lib/chain/reads";
import {
  CURATED_BUNDLES,
  curatedDiscountPct,
  type CuratedBundle,
} from "@/lib/chain/curated-bundles";
import { BundleManager } from "./bundle-manager";

export const metadata = {
  title: "Bundles | MCPX",
  description:
    "Curated MCP server bundles — enable several servers in one tap at a discounted per-call rate.",
};

interface DisplayBundle {
  key: string;
  name: string;
  description: string;
  serverCount: number;
  discountPct: number;
  active: boolean;
  /** Indexer-mirrored object id once seeded on-chain, else null. */
  bundleObjectId: string | null;
}

/**
 * S5-T20. Server component. The curated catalog (S5-T19) is the source of
 * names/descriptions so the page is never empty pre-mainnet; the indexer
 * mirror (bundles_public via migration 009) is matched in by name to attach
 * the real on-chain object id + live discount once seeded (S5-T22). Reads
 * the mirror only — never writes it (ADR-011).
 */
export default async function BundlesPage() {
  let mirrored: BundleRow[] = [];
  try {
    mirrored = await listBundles();
  } catch {
    // Mirror unavailable (e.g. Supabase env unset in local dev) — fall back
    // to the static curated catalog so the page still renders.
    mirrored = [];
  }
  const byName = new Map(
    mirrored.filter((b) => b.name).map((b) => [b.name as string, b]),
  );

  const fromCurated: DisplayBundle[] = CURATED_BUNDLES.map(
    (c: CuratedBundle) => {
      const m = byName.get(c.name);
      return {
        key: c.slug,
        name: c.name,
        description: c.description,
        serverCount: m?.serverCount ?? c.serverNamespaces.length,
        discountPct: m?.discountPct ?? curatedDiscountPct(c),
        active: m?.active ?? true,
        bundleObjectId: m?.id ?? null,
      };
    },
  );

  // Any on-chain bundle not in the curated catalog (community bundles).
  const curatedNames = new Set(CURATED_BUNDLES.map((c) => c.name));
  const extra: DisplayBundle[] = mirrored
    .filter((b) => !b.name || !curatedNames.has(b.name))
    .map((b) => ({
      key: b.id,
      name: b.name ?? "Untitled bundle",
      description: `${b.serverCount} server${b.serverCount === 1 ? "" : "s"} · curated by ${b.creator.slice(0, 10)}…`,
      serverCount: b.serverCount,
      discountPct: b.discountPct,
      active: b.active,
      bundleObjectId: b.id,
    }));

  const bundles = [...fromCurated, ...extra];

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {/* Header — same nav as /marketplace */}
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
            <Link
              href="/marketplace"
              className="text-sm hover:opacity-80"
              style={{ color: "var(--text-secondary)" }}
            >
              Marketplace
            </Link>
            <Link
              href="/bundles"
              className="text-sm font-medium"
              style={{ color: "var(--primary)" }}
            >
              Bundles
            </Link>
            <Link
              href="/pricing"
              className="text-sm hover:opacity-80"
              style={{ color: "var(--text-secondary)" }}
            >
              Pricing
            </Link>
            <Link
              href="/developers"
              className="text-sm hover:opacity-80"
              style={{ color: "var(--text-secondary)" }}
            >
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

      <div className="max-w-7xl mx-auto px-6 pt-28 pb-12">
        <div className="mb-10">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">
            <span className="text-gradient">Bundles</span>
          </h1>
          <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
            Enable a whole workflow in one tap — every server in the bundle, at
            a discounted per-call rate.
          </p>
        </div>

        {bundles.length === 0 ? (
          <div
            className="text-center py-20 rounded-2xl border"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <h3
              className="text-lg font-semibold mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              No bundles yet
            </h3>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Curated bundles arrive with the mainnet launch.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bundles.map((b) => (
              <div key={b.key} className="card-premium h-full p-6 flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3
                    className="font-semibold text-lg"
                    style={{ color: "var(--text)" }}
                  >
                    {b.name}
                  </h3>
                  {b.discountPct > 0 && (
                    <span
                      className="px-2 py-0.5 rounded-md text-xs font-semibold shrink-0"
                      style={{
                        background: "var(--primary-glow)",
                        color: "var(--primary)",
                      }}
                    >
                      {b.discountPct}% off
                    </span>
                  )}
                </div>
                <p
                  className="text-sm leading-relaxed mb-4 flex-1"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {b.description}
                </p>
                <div
                  className="flex items-center gap-3 text-xs mb-4"
                  style={{ color: "var(--text-muted)" }}
                >
                  <span>
                    {b.serverCount} server{b.serverCount === 1 ? "" : "s"}
                  </span>
                  <span>·</span>
                  <span>{b.active ? "Active" : "Inactive"}</span>
                  {!b.bundleObjectId && (
                    <>
                      <span>·</span>
                      <span>Not yet on-chain</span>
                    </>
                  )}
                </div>
                <BundleManager
                  item={{ bundleObjectId: b.bundleObjectId, name: b.name }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
