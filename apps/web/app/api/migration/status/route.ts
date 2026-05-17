import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * S8-T02. Reports whether the signed-in user is a migrated Web2 user who
 * hasn't acknowledged the move yet. The migration script (S8-T01, a
 * separate workstream) flips `users.migration_status` to `migrated`; this
 * route only reads it. Degrades to `{ migrated: false }` whenever the
 * column / user is unavailable so the banner simply never shows.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  let user;
  try {
    user = await getCurrentUser();
  } catch {
    return NextResponse.json({ migrated: false });
  }
  if (!user) return NextResponse.json({ migrated: false });

  // `migrated` = legacy balance was moved on-chain by the migration script.
  // Any other status (legacy / migrating / unknown) → no welcome-back banner.
  const migrated = user.migrationStatus === "migrated";
  return NextResponse.json({
    migrated,
    hasWallet: Boolean(user.suiAddress),
  });
}
