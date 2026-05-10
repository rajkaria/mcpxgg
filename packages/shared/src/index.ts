/**
 * @mcpxgg/shared — shared utilities across all apps.
 *
 * Sprint 0 task S0-T14 moves the existing `apps/web/lib/{supabase,cache,twilio,utils,validation}`
 * here and rewires imports throughout the monorepo.
 *
 * After Sprint 0, exports include:
 *   - createSupabaseServerClient, createSupabaseAdminClient, createSupabaseBrowserClient
 *   - upstash redis cache (cacheGet, cacheSet, cacheDel)
 *   - twilio verify (sendCode, verifyCode)
 *   - api-key generation utility
 *   - mcpx.config.json validation
 *   - shared error types
 */

export const SHARED_VERSION = '0.1.0';
