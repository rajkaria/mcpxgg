import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSessionBalance } from "@/lib/chain/reads";
import { redis } from "@/lib/cache/upstash";

/**
 * S6-T23. Low-balance alert. The dashboard polls this; when the signed-in
 * user's session balance is below the threshold it returns `low: true` (for
 * the in-app banner) and fires a one-time email.
 *
 * No dedicated email helper exists in the repo yet, so this adds a minimal
 * Resend send (the provider used elsewhere in the stack). It degrades to a
 * silent skip when RESEND_API_KEY is unset (BLOCKED.md — email env). A
 * last-sent marker in Redis (24h TTL) prevents double-sends; without Redis
 * the banner still works, only the email dedup is best-effort.
 */

const THRESHOLD_ATOMIC = 500_000n; // $0.50 in USDsui 6-decimal atomic units.

async function sendLowBalanceEmail(to: string, balanceUsd: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ALERTS_FROM_EMAIL ?? "alerts@mcpx.gg";
  if (!key) {
    console.warn("[low-balance] RESEND_API_KEY unset — skipping email send");
    return;
  }
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: "Your MCPX session balance is low",
        text: `Your MCPX session balance is down to $${balanceUsd} USDsui. Recharge to avoid interrupted tool calls: https://mcpx.gg/dashboard/billing`,
      }),
    });
  } catch (e) {
    console.warn("[low-balance] email send failed:", e);
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.suiAddress) return NextResponse.json({ low: false });

  let balanceAtomic = 0n;
  let hasSession = false;
  try {
    const bal = await getSessionBalance(user.suiAddress);
    if (bal) {
      hasSession = true;
      balanceAtomic = bal.balanceAtomic;
    }
  } catch {
    return NextResponse.json({ low: false });
  }
  if (!hasSession) return NextResponse.json({ low: false });

  const low = balanceAtomic < THRESHOLD_ATOMIC;
  const balanceUsd = `${(Number(balanceAtomic) / 1_000_000).toFixed(2)}`;

  if (low) {
    const sentKey = `low-balance-sent:${user.id}`;
    let alreadySent = false;
    if (process.env.UPSTASH_REDIS_REST_URL) {
      try {
        alreadySent = Boolean(await redis.get(sentKey));
      } catch {
        alreadySent = false;
      }
    }
    if (!alreadySent && user.email) {
      await sendLowBalanceEmail(user.email, balanceUsd);
      if (process.env.UPSTASH_REDIS_REST_URL) {
        try {
          await redis.set(sentKey, Date.now(), { ex: 86400 });
        } catch {
          /* best-effort */
        }
      }
    }
  } else if (process.env.UPSTASH_REDIS_REST_URL) {
    // Balance recovered — clear the marker so a future dip re-alerts.
    try {
      await redis.del(`low-balance-sent:${user.id}`);
    } catch {
      /* best-effort */
    }
  }

  return NextResponse.json({ low, balanceUsd });
}
