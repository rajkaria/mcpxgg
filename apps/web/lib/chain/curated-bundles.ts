/**
 * S5-T19 — curated bundle catalog.
 *
 * These are the three launch bundles. They render on /bundles *before* the
 * on-chain seed (S5-T19 via scripts/seed-bundles.ts) lands, so the page is
 * never empty pre-mainnet (S5-T22). Once the indexer mirrors the real
 * BundleCreated events, listBundles() from the `bundles_public` view takes
 * over and these are matched by `name` to attach the real bundleObjectId.
 *
 * `serverNamespaces` are the marketplace namespaces each bundle composes.
 * Some are placeholders for first-party servers not yet published
 * (sui-analytics, walrus-store, sui-identity) — the seed script reads real
 * object ids from a JSON map; these strings are display-only here.
 *
 * priceMultiplierX100: per-call multiplier ×100 (90 = 0.9× = 10% off).
 */

export interface CuratedBundle {
  /** Stable slug used for the /bundles route + de-dup against the mirror. */
  slug: string;
  name: string;
  description: string;
  serverNamespaces: string[];
  priceMultiplierX100: number;
}

export const CURATED_BUNDLES: readonly CuratedBundle[] = [
  {
    slug: "defi-research",
    name: "DeFi research",
    description:
      "On-chain DeFi market data plus analytics — everything an agent needs to research Sui DeFi positions.",
    serverNamespaces: ["sui-defi-data", "sui-analytics"],
    priceMultiplierX100: 90, // 10% off
  },
  {
    slug: "walrus-toolkit",
    name: "Walrus toolkit",
    description:
      "Search and store blobs on Walrus from one bundle — the full read+write decentralized-storage workflow.",
    serverNamespaces: ["walrus-search", "walrus-store"],
    priceMultiplierX100: 85, // 15% off
  },
  {
    slug: "identity-stack",
    name: "Identity stack",
    description:
      "Sui identity resolution paired with analytics for agent KYC and reputation workflows.",
    serverNamespaces: ["sui-identity", "sui-analytics"],
    priceMultiplierX100: 90, // 10% off
  },
] as const;

/** Whole-percent discount derived from the per-call multiplier. */
export function curatedDiscountPct(b: CuratedBundle): number {
  return Math.max(0, 100 - b.priceMultiplierX100);
}

export function getCuratedBundle(slug: string): CuratedBundle | undefined {
  return CURATED_BUNDLES.find((b) => b.slug === slug);
}
