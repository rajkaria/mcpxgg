import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveChain } from "@mcpxgg/chain";
import { createClient } from "@/lib/supabase/server";
import { getMarketplaceServer, getServerStake, usdsui } from "@/lib/chain/reads";
import { QualityBadge } from "@/components/QualityBadge";
import { StakeBadge } from "@/components/StakeBadge";
import { DemoCallButton } from "@/components/DemoCallButton";
import { EmbedWidget } from "@/components/EmbedWidget";
import { ServerDetailClient } from "./server-detail-client";

const WALRUS_AGG =
  process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR_URL ??
  "https://aggregator.walrus-testnet.walrus.space";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ namespace: string }>;
}) {
  const { namespace } = await params;
  const supabase = await createClient();
  const { data: server } = await supabase
    .from("mcp_servers")
    .select("name, description")
    .eq("namespace", namespace)
    .single();

  if (!server) return { title: "Server Not Found | MCPX" };

  return {
    title: `${(server as any).name} | MCPX Marketplace`,
    description: (server as any).description,
  };
}

export default async function ServerDetailPage({
  params,
}: {
  params: Promise<{ namespace: string }>;
}) {
  const { namespace } = await params;
  const supabase = await createClient();

  // Fetch server
  const { data: server, error } = await supabase
    .from("mcp_servers")
    .select("*")
    .eq("namespace", namespace)
    .single();

  if (error || !server) {
    notFound();
  }

  const s = server as any;
  // S4-T13: chain-mirror facts (object id, README blob, settle digest).
  const view = await getMarketplaceServer(namespace);
  const chain = getActiveChain();
  // S7-T11: SLA stake (indexer `stakes` mirror) for the trust badge.
  const stake = view ? await getServerStake(view.objectId).catch(() => null) : null;

  // Fetch tools for this server
  const { data: tools } = await supabase
    .from("mcp_tools")
    .select("*")
    .eq("server_id", s.id)
    .order("tool_name");

  // Fetch reviews
  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, rating, review_text, created_at, user_id")
    .eq("server_id", s.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <nav
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.7)" }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-xl font-bold tracking-tight"
              style={{ color: "var(--text)", fontFamily: "var(--font-dm-sans)" }}
            >
              MCPX
            </Link>
            <span style={{ color: "var(--border)" }}>/</span>
            <Link
              href="/marketplace"
              className="text-sm hover:opacity-80"
              style={{ color: "var(--text-secondary)" }}
            >
              Marketplace
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <button
                className="px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-80"
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

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-8" style={{ color: "var(--text-muted)" }}>
          <Link href="/marketplace" className="hover:opacity-80">
            Marketplace
          </Link>
          <span>/</span>
          <span style={{ color: "var(--text-secondary)" }}>{s.name}</span>
        </div>

        {/* Server header */}
        <div className="flex flex-col md:flex-row md:items-start gap-6 mb-12">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            {s.icon_url ? (
              <img src={s.icon_url} alt={s.name} className="w-full h-full rounded-2xl object-cover" />
            ) : (
              s.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{s.name}</h1>
              {s.category && (
                <span
                  className="inline-flex px-3 py-0.5 rounded-full text-xs font-medium border self-start"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  {s.category}
                </span>
              )}
              <QualityBadge scoreX100={view?.qualityScoreX100} size="md" />
              <StakeBadge
                remainingAtomic={stake ? stake.remainingAtomic : null}
                slaUptimeX100={stake ? stake.slaUptimeX100 : null}
                size="md"
              />
            </div>
            <p
              className="text-sm font-mono mb-3"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-jetbrains-mono)" }}
            >
              {s.namespace}
            </p>
            <p className="text-base leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>
              {s.description || "No description available."}
            </p>

            {view && (
              <div className="flex flex-wrap gap-4 mb-6 text-sm">
                <a
                  className="underline"
                  style={{ color: "var(--primary)" }}
                  href={chain.objectExplorerUrl(view.objectId)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View on chain ↗
                </a>
                {view.metadataBlobId && (
                  <a
                    className="underline"
                    style={{ color: "var(--primary)" }}
                    href={`${WALRUS_AGG}/v1/blobs/${view.metadataBlobId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    README on Walrus ↗
                  </a>
                )}
                {view.txDigest && (
                  <a
                    className="underline opacity-70"
                    href={chain.txExplorerUrl(view.txDigest)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    publish tx ↗
                  </a>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="flex flex-wrap gap-6 text-sm" style={{ color: "var(--text-muted)" }}>
              {s.avg_rating > 0 && (
                <div className="flex items-center gap-1.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--warning)" }}>
                    <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" />
                  </svg>
                  <span>{Number(s.avg_rating).toFixed(1)} rating</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                <span>{s.total_users || 0} users</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.384 3.065A1 1 0 014.5 17.28V6.72a1 1 0 011.536-.845l5.384 3.066a1 1 0 010 1.708z" />
                </svg>
                <span>{((tools as any) || []).length} tools</span>
              </div>
            </div>
          </div>
          <div className="shrink-0 space-y-3">
            <ServerDetailClient serverId={s.id} serverName={s.name} />
            <DemoCallButton serverObjectId={view?.objectId ?? null} />
          </div>
        </div>

        {/* Tools table */}
        {((tools as any) || []).length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold mb-4">Available Tools</h2>
            <div
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: "var(--border)" }}
            >
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--surface)" }}>
                    <th
                      className="text-left px-6 py-3 font-medium"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Tool
                    </th>
                    <th
                      className="text-left px-6 py-3 font-medium hidden md:table-cell"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Description
                    </th>
                    <th
                      className="text-left px-6 py-3 font-medium"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Cost
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {((tools as any) || []).map((tool: any, i: number) => (
                    <tr
                      key={tool.id}
                      className="border-t"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <td className="px-6 py-4">
                        <span
                          className="font-mono text-sm font-medium"
                          style={{
                            color: "var(--text)",
                            fontFamily: "var(--font-jetbrains-mono)",
                          }}
                        >
                          {tool.tool_name}
                        </span>
                      </td>
                      <td
                        className="px-6 py-4 hidden md:table-cell"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {tool.description || "No description"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="inline-flex px-2 py-0.5 rounded text-xs font-medium"
                          style={{
                            background: "var(--surface)",
                            color: "var(--text-muted)",
                          }}
                        >
                          {tool.price_atomic
                            ? `${usdsui(BigInt(tool.price_atomic))} USDsui`
                            : "free"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Embed widget (S7-T25): the live <mcpx-call> for this server. */}
        {((tools as any) || []).length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold mb-2">Embed this server</h2>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--text-muted)" }}
            >
              Drop this server's tool into any page with one script tag. Every
              call settles on-chain in USDsui.{" "}
              <Link href="/docs/embed" className="underline">
                Embed docs ↗
              </Link>
            </p>
            <div className="max-w-md">
              <EmbedWidget
                server={s.namespace}
                tool={((tools as any)[0] as any).tool_name}
              />
            </div>
          </section>
        )}

        {/* Reviews section */}
        <section>
          <h2 className="text-xl font-semibold mb-4">
            Reviews
            {((reviews as any) || []).length > 0 && (
              <span className="text-sm font-normal ml-2" style={{ color: "var(--text-muted)" }}>
                ({((reviews as any) || []).length})
              </span>
            )}
          </h2>
          {((reviews as any) || []).length === 0 ? (
            <div
              className="text-center py-12 rounded-xl border"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No reviews yet. Be the first to review this server.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {((reviews as any) || []).map((review: any) => (
                <div
                  key={review.id}
                  className="p-5 rounded-xl border"
                  style={{ background: "var(--surface)", borderColor: "var(--border)" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: "var(--primary)", color: "#fff" }}
                      >
                        {(review.users?.display_name || review.users?.email || "?").charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">
                        {review.users?.display_name || review.users?.email || "Anonymous"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg
                          key={i}
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill={i < review.rating ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth={1.5}
                          style={{ color: i < review.rating ? "var(--warning)" : "var(--border)" }}
                        >
                          <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                  {review.review_text && (
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {review.review_text}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
