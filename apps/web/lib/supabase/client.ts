"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  // Fallbacks keep static prerender from throwing when public env is absent
  // (e.g. CI build without secrets). In the browser Next inlines the real
  // NEXT_PUBLIC_* values, so the live client is always correctly configured.
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
  );
}
