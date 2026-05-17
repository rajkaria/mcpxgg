"use client";

/**
 * S4-T20: PostHog product analytics. No-ops unless NEXT_PUBLIC_POSTHOG_KEY
 * is set, so local/dev and CI never phone home.
 */

import posthog from "posthog-js";

let started = false;

export function initPosthog(): void {
  if (started || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: true,
    autocapture: true,
  });
  started = true;
}

export { posthog };
