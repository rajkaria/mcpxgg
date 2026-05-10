"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface ServerDetailClientProps {
  serverId: string;
  serverName: string;
}

export function ServerDetailClient({ serverId, serverName }: ServerDetailClientProps) {
  const supabase = createClient();
  const [enabling, setEnabling] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const handleEnable = async () => {
    setEnabling(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login?redirect=/marketplace/" + encodeURIComponent(serverName);
      return;
    }

    // Check if already enabled
    const { data: existing } = await supabase
      .from("user_enabled_servers")
      .select("id")
      .eq("user_id", user.id)
      .eq("server_id", serverId)
      .single();

    if (existing) {
      setEnabled(true);
      setEnabling(false);
      return;
    }

    const { error: insertError } = await supabase
      .from("user_enabled_servers")
      .insert({ user_id: user.id, server_id: serverId });

    if (insertError) {
      setError("Failed to enable server. Please try again.");
    } else {
      setEnabled(true);
      // Best-effort increment total_users
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).rpc("increment_total_users", { sid: serverId }).catch(() => {});
    }

    setEnabling(false);
  };

  const handleDisable = async () => {
    setEnabling(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase
      .from("user_enabled_servers")
      .delete()
      .eq("user_id", user.id)
      .eq("server_id", serverId);

    setEnabled(false);
    setEnabling(false);
  };

  const handleSubmitReview = async () => {
    setSubmittingReview(true);

    try {
      const res = await fetch("/api/marketplace/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          server_id: serverId,
          rating: reviewRating,
          review_text: reviewText,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit review");
      } else {
        setShowReviewForm(false);
        setReviewText("");
        window.location.reload();
      }
    } catch {
      setError("Failed to submit review");
    }

    setSubmittingReview(false);
  };

  return (
    <div className="space-y-4">
      {/* Enable/Disable button */}
      {enabled ? (
        <div className="flex flex-col gap-2">
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: "var(--surface)", color: "var(--success)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Enabled
          </div>
          <Button variant="ghost" size="sm" onClick={handleDisable} loading={enabling}>
            Disable
          </Button>
        </div>
      ) : (
        <Button variant="primary" onClick={handleEnable} loading={enabling}>
          Enable this server
        </Button>
      )}

      {error && (
        <p className="text-xs" style={{ color: "var(--error)" }}>
          {error}
        </p>
      )}

      {/* Write review button */}
      <div className="pt-4">
        {showReviewForm ? (
          <div
            className="p-4 rounded-xl border space-y-3"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <button key={i} onClick={() => setReviewRating(i + 1)}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill={i < reviewRating ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth={1.5}
                    style={{ color: i < reviewRating ? "var(--warning)" : "var(--border)" }}
                  >
                    <path d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" />
                  </svg>
                </button>
              ))}
            </div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Write your review (optional)..."
              rows={3}
              className="w-full rounded-lg p-3 text-sm resize-none"
              style={{
                background: "var(--bg)",
                color: "var(--text)",
                borderColor: "var(--border)",
                border: "1px solid var(--border)",
              }}
            />
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={handleSubmitReview} loading={submittingReview}>
                Submit review
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowReviewForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setShowReviewForm(true)}>
            Write a review
          </Button>
        )}
      </div>
    </div>
  );
}
