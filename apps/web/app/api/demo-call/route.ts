import { NextRequest, NextResponse } from "next/server";
import { verifyPrivyToken } from "@/lib/privy/server";
import { redis } from "@/lib/cache/upstash";

/**
 * S6-T22. "Try before you enable" — one free, treasury-subsidised call.
 *
 * Reuses the S4-T15/T16 bootstrap-subsidy gatekeeper in the facilitator
 * (`POST /admin/subsidy/grant`, apps/facilitator/src/subsidy.ts +
 * apps/facilitator/src/app.ts): that module owns the monthly budget +
 * one-grant-per-address policy. This route additionally rate-limits to one
 * demo per (user, server) via a 24h Redis key so a user can't drain a single
 * server's demo allowance.
 *
 * The facilitator is the single authority for subsidy spend; the web never
 * signs settlement (gateway/facilitator boundary — see CLAUDE.md).
 */

const FACILITATOR_URL =
  process.env.FACILITATOR_URL ?? process.env.NEXT_PUBLIC_FACILITATOR_URL ?? "";
const FACILITATOR_ADMIN_TOKEN = process.env.FACILITATOR_ADMIN_TOKEN ?? "";

export async function POST(req: NextRequest) {
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.toLowerCase().startsWith("bearer ")
    ? authz.slice(7).trim()
    : "";
  if (!token) {
    return NextResponse.json({ error: "missing token" }, { status: 401 });
  }

  let identity;
  try {
    identity = await verifyPrivyToken(token);
  } catch {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }
  if (!identity.suiAddress) {
    return NextResponse.json(
      { error: "link a Sui wallet to try a demo call" },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    serverObjectId?: string;
  };
  if (!body.serverObjectId) {
    return NextResponse.json(
      { error: "serverObjectId required" },
      { status: 400 },
    );
  }

  // Per-(user, server) rate limit: 1 demo / 24h. Degrades open if Redis is
  // unconfigured (local dev) rather than crashing.
  const rlKey = `demo-call:${identity.suiAddress}:${body.serverObjectId}`;
  if (process.env.UPSTASH_REDIS_REST_URL) {
    try {
      const already = await redis.get<number>(rlKey);
      if (already) {
        return NextResponse.json(
          { error: "demo already used for this server", reason: "rate_limited" },
          { status: 429 },
        );
      }
    } catch {
      /* Redis transient — allow through */
    }
  }

  if (!FACILITATOR_URL || !FACILITATOR_ADMIN_TOKEN) {
    return NextResponse.json(
      {
        error:
          "demo calls unavailable: facilitator subsidy not configured (FACILITATOR_URL / FACILITATOR_ADMIN_TOKEN)",
        reason: "not_configured",
      },
      { status: 503 },
    );
  }

  let decision: {
    approved?: boolean;
    amountAtomic?: string;
    reason?: string;
  };
  try {
    const res = await fetch(
      `${FACILITATOR_URL.replace(/\/$/, "")}/admin/subsidy/grant`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${FACILITATOR_ADMIN_TOKEN}`,
        },
        body: JSON.stringify({ address: identity.suiAddress }),
      },
    );
    decision = (await res.json()) as typeof decision;
    if (!res.ok || !decision.approved) {
      return NextResponse.json(
        {
          error: "demo not approved",
          reason: decision.reason ?? "subsidy_declined",
        },
        { status: 402 },
      );
    }
  } catch (e) {
    return NextResponse.json(
      { error: `facilitator unreachable: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }

  if (process.env.UPSTASH_REDIS_REST_URL) {
    try {
      await redis.set(rlKey, Date.now(), { ex: 86400 });
    } catch {
      /* best-effort */
    }
  }

  return NextResponse.json({
    ok: true,
    grantedAtomic: decision.amountAtomic ?? "0",
    message:
      "Demo authorized — a treasury-funded credit was applied to your session. Make a call from your agent to try this server free.",
  });
}
