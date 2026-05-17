/**
 * S8-T16/T17 — the five first-party "anchor" MCP servers shipped through
 * Sprints 5–7. Display-only metadata for the landing page + marketing
 * surfaces. The live, on-chain registry is the source of truth (see
 * listMarketplaceServers); these are curated cards that render even before
 * the indexer mirror is hydrated, so the homepage is never empty pre-mainnet.
 */

export interface AnchorServer {
  /** Marketplace namespace — also the /marketplace/[namespace] route slug. */
  namespace: string;
  name: string;
  tagline: string;
  category: string;
  /** Accent color, reused from the palette already in globals.css. */
  color: string;
}

export const ANCHOR_SERVERS: readonly AnchorServer[] = [
  {
    namespace: "walrus-search",
    name: "Walrus Search",
    tagline:
      "Full-text and semantic search across Walrus blobs — read the decentralized web.",
    category: "Data",
    color: "#818cf8",
  },
  {
    namespace: "walrus-store",
    name: "Walrus Store",
    tagline:
      "Upload, retrieve, and inspect permanent blobs on Walrus from any agent.",
    category: "Data",
    color: "#34d399",
  },
  {
    namespace: "sui-identity",
    name: "Sui Identity",
    tagline:
      "Resolve addresses & names, verify zkLogin, and score on-chain reputation.",
    category: "Security",
    color: "#fbbf24",
  },
  {
    namespace: "sui-analytics",
    name: "Sui Analytics",
    tagline:
      "Query Sui chain analytics — volume, holders, activity — for any object or address.",
    category: "Analytics",
    color: "#f472b6",
  },
  {
    namespace: "sui-defi-data",
    name: "Sui DeFi Data",
    tagline:
      "Live DeFi market data across Sui pools, prices, and yields for research agents.",
    category: "Analytics",
    color: "#60a5fa",
  },
] as const;
