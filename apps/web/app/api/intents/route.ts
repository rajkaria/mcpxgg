import { NextRequest, NextResponse } from "next/server";
import { buildCreateIntentTx, buildRevokeIntentTx } from "@mcpxgg/chain";
import { verifyPrivyToken } from "@/lib/privy/server";
import { listIntentsForUser } from "@/lib/chain/reads";
import { suiTxConfig, usdToUsdsuiAtomic } from "@/lib/chain/config";

/**
 * S6-T05. SpendingIntents API.
 *
 *   GET    — list the signed-in user's intents (reads the `intents` mirror;
 *            never writes it — ADR-011).
 *   POST   — build the `intent::create` PTB for the Privy wallet to sign.
 *   DELETE — build the `intent::revoke` PTB for the Privy wallet to sign.
 *
 * Mirrors the session-recharge pattern (S4-T06/T07): the server only builds
 * BCS bytes; the embedded wallet signs+submits; the indexer mirrors the
 * resulting events into the `intents` table.
 */

async function identityFromReq(req: NextRequest) {
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.toLowerCase().startsWith("bearer ")
    ? authz.slice(7).trim()
    : "";
  if (!token) return { error: "missing token", status: 401 as const };
  try {
    const id = await verifyPrivyToken(token);
    if (!id.suiAddress)
      return { error: "no Sui wallet linked to this account", status: 400 as const };
    return { id };
  } catch {
    return { error: "invalid token", status: 401 as const };
  }
}

export async function GET(req: NextRequest) {
  const r = await identityFromReq(req);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  try {
    const intents = await listIntentsForUser(r.id.suiAddress!);
    return NextResponse.json({
      intents: intents.map((i) => ({
        ...i,
        dailyCapAtomic: i.dailyCapAtomic.toString(),
        perCallCapAtomic: i.perCallCapAtomic.toString(),
        expiresAtMs: i.expiresAtMs.toString(),
        todaySpentAtomic: i.todaySpentAtomic.toString(),
        lifetimeSpentAtomic: i.lifetimeSpentAtomic.toString(),
      })),
    });
  } catch {
    // Mirror unavailable (no Supabase env in local dev) — degrade gracefully.
    return NextResponse.json({ intents: [] });
  }
}

export async function POST(req: NextRequest) {
  const r = await identityFromReq(req);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const body = (await req.json().catch(() => ({}))) as {
    agentAddress?: string;
    dailyCapUsd?: number;
    perCallCapUsd?: number;
    allowedCategories?: string[];
    serverObjectIds?: string[];
    expiresAtMs?: number;
  };

  if (!body.agentAddress || !body.agentAddress.startsWith("0x")) {
    return NextResponse.json({ error: "agentAddress required" }, { status: 400 });
  }
  let dailyCapAtomic: bigint;
  let perCallCapAtomic: bigint;
  try {
    dailyCapAtomic = usdToUsdsuiAtomic(Number(body.dailyCapUsd));
    perCallCapAtomic = usdToUsdsuiAtomic(Number(body.perCallCapUsd));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bad cap" },
      { status: 400 },
    );
  }
  const expiresAtMs = BigInt(
    Math.trunc(body.expiresAtMs ?? Date.now() + 30 * 24 * 60 * 60 * 1000),
  );

  let cfg;
  try {
    cfg = suiTxConfig();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "chain not configured" },
      { status: 503 },
    );
  }

  try {
    const built = await buildCreateIntentTx({
      cfg,
      sender: r.id.suiAddress!,
      agentAddress: body.agentAddress,
      dailyCapAtomic,
      perCallCapAtomic,
      serverObjectIds: Array.isArray(body.serverObjectIds)
        ? body.serverObjectIds
        : [],
      allowedCategories: Array.isArray(body.allowedCategories)
        ? body.allowedCategories
        : [],
      expiresAtMs,
    });
    return NextResponse.json({ txBytesB64: built.txBytesB64 });
  } catch (e) {
    return NextResponse.json(
      { error: `tx build failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const r = await identityFromReq(req);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const body = (await req.json().catch(() => ({}))) as { intentObjectId?: string };
  if (!body.intentObjectId) {
    return NextResponse.json({ error: "intentObjectId required" }, { status: 400 });
  }

  let cfg;
  try {
    cfg = suiTxConfig();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "chain not configured" },
      { status: 503 },
    );
  }

  try {
    const built = await buildRevokeIntentTx({
      cfg,
      sender: r.id.suiAddress!,
      intentObjectId: body.intentObjectId,
    });
    return NextResponse.json({ txBytesB64: built.txBytesB64 });
  } catch (e) {
    return NextResponse.json(
      { error: `tx build failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }
}
