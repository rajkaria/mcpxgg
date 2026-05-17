/**
 * S6-T25. Admin gating. No existing admin model in the repo, so gate by an
 * allowlist env: ADMIN_EMAILS (comma-separated). Empty allowlist = locked
 * (deny everyone) so the admin surface is never accidentally public.
 */

import "server-only";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/current-user";

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireAdmin(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user?.email) return null;
  const allow = adminEmails();
  if (allow.length === 0) return null;
  return allow.includes(user.email.toLowerCase()) ? user : null;
}
