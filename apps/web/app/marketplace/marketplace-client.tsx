"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { QualityBadge } from "@/components/QualityBadge";

interface Server {
  id: string;
  name: string;
  namespace: string;
  description: string;
  category: string;
  total_users: number;
  avg_rating: number;
  icon_url: string | null;
  status: string;
  created_at: string;
  quality_score_x100?: number | null;
  featured?: boolean;
}

interface MarketplaceClientProps {
  initialServers: Server[];
  categories: string[];
  initialQuery: string;
  initialCategory: string;
  initialSort: string;
}

export function MarketplaceClient({
  initialServers,
  categories,
  initialQuery,
  initialCategory,
  initialSort,
}: MarketplaceClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState(initialSort);

  const updateSearch = useCallback(
    (q: string, cat: string, s: string) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (cat && cat !== "All") params.set("category", cat);
      if (s && s !== "popular") params.set("sort", s);
      router.push(`/marketplace?${params.toString()}`);
    },
    [router]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSearch(search, category, sort);
  };

  const handleCategoryClick = (cat: string) => {
    setCategory(cat);
    updateSearch(search, cat, sort);
  };

  const handleSortChange = (newSort: string) => {
    setSort(newSort);
    updateSearch(search, category, newSort);
  };

  return (
    <>
      {/* Search + Sort row */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <form onSubmit={handleSearchSubmit} className="flex-1">
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              width="18"
              height="18"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              style={{ color: "var(--text-muted)" }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <Input
              type="text"
              placeholder="Search servers by name, description, or namespace..."
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              className="pl-11 w-full"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
          </div>
        </form>
        <div className="flex gap-2">
          {(["popular", "newest", "rating"] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleSortChange(s)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 border"
              style={{
                background: sort === s ? "var(--primary)" : "transparent",
                color: sort === s ? "#fff" : "var(--text-secondary)",
                borderColor: sort === s ? "var(--primary)" : "var(--border)",
              }}
            >
              {s === "popular" ? "Popular" : s === "newest" ? "Newest" : "Top Rated"}
            </button>
          ))}
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 mb-10">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryClick(cat)}
            className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 border"
            style={{
              background: category === cat ? "var(--primary)" : "transparent",
              color: category === cat ? "#fff" : "var(--text-secondary)",
              borderColor: category === cat ? "var(--primary)" : "var(--border)",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Server grid */}
      {initialServers.length === 0 ? (
        <div
          className="text-center py-20 rounded-2xl border"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <svg
            className="mx-auto mb-4"
            width="48"
            height="48"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
            style={{ color: "var(--text-muted)" }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
            No servers found
          </h3>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Try adjusting your search or filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {initialServers.map((server) => (
            <Link key={server.id} href={`/marketplace/${server.namespace}`}>
              <div className="card-premium h-full p-6 cursor-pointer">
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
                    style={{
                      background: "var(--primary-glow)",
                      color: "var(--primary)",
                    }}
                  >
                    {server.icon_url ? (
                      <img
                        src={server.icon_url}
                        alt={server.name}
                        className="w-full h-full rounded-xl object-cover"
                      />
                    ) : (
                      server.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base truncate" style={{ color: "var(--text)" }}>
                        {server.name}
                      </h3>
                      {server.featured && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0"
                          style={{
                            background: "var(--primary-glow)",
                            color: "var(--primary)",
                          }}
                        >
                          Featured
                        </span>
                      )}
                    </div>
                    <p
                      className="text-xs font-mono truncate"
                      style={{
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-jetbrains-mono)",
                      }}
                    >
                      {server.namespace}
                    </p>
                  </div>
                </div>
                <p
                  className="text-sm leading-relaxed mb-4 line-clamp-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {server.description || "No description available."}
                </p>
                <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                  <div className="flex items-center gap-3">
                    {server.avg_rating > 0 && (
                      <span className="flex items-center gap-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--warning)" }}>
                          <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" />
                        </svg>
                        {Number(server.avg_rating).toFixed(1)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      {server.total_users || 0}
                    </span>
                    <QualityBadge scoreX100={server.quality_score_x100} />
                  </div>
                  {server.category && (
                    <span
                      className="px-2 py-0.5 rounded-md text-xs"
                      style={{
                        background: "var(--bg)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {server.category}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
