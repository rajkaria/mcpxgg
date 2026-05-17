import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mcpx.gg";

/**
 * S8-T18. Static public routes only — dynamic/auth surfaces are excluded
 * (covered by robots.ts disallow). Marketplace server detail pages are
 * indexer-mirror-derived and high-cardinality; left out of the static
 * sitemap intentionally.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: Array<{
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }> = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/marketplace", priority: 0.9, changeFrequency: "daily" },
    { path: "/pricing", priority: 0.8, changeFrequency: "monthly" },
    { path: "/developers", priority: 0.8, changeFrequency: "monthly" },
    { path: "/about", priority: 0.5, changeFrequency: "monthly" },
    { path: "/security", priority: 0.6, changeFrequency: "monthly" },
    { path: "/roadmap", priority: 0.6, changeFrequency: "weekly" },
    { path: "/insurance", priority: 0.6, changeFrequency: "daily" },
    { path: "/status", priority: 0.5, changeFrequency: "hourly" },
    { path: "/live", priority: 0.5, changeFrequency: "hourly" },
    { path: "/bundles", priority: 0.6, changeFrequency: "weekly" },
  ];
  return routes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
