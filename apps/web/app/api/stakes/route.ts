import { NextRequest, NextResponse } from "next/server";
import {
  buildPostStakeTx,
  buildTopUpStakeTx,
  buildWithdrawStakeTx,
  type SlaTier,
} from "@mcpxgg/chain";
import { verifyPrivyToken } from "@/lib/privy/server";
import { listStakesForUser } from "@/lib/chain/reads";
import {
  platformConfigId,
  suiTxConfig,
  usdToUsdsuiAtomic,
} from "@/lib/chain/config";

/**
 * S7-T10. SLA staking API.
 *
 *   GET    — list the signed-in developer's stakes + slash history (reads the
 *            `stakes`/`stake_slashes` mirror; never writes it — ADR-011).
 *   POST   — build the `staking::post` PTB for the Privy wallet to sign.
 *   PATCH  — build the `staking::top_up` PTB.
 *   DELETE — build the `staking::withdraw` PTB.
 *
 * Identical architecture to /api/intents (S6-T05) and session recharge: the
 * server only builds BCS bytes; the Privy embedded wallet signs+submits; the
 * indexer mirrors StakePosted/StakeSlashed into `stakes`/`stake_slashes`.
 */

const VALID_TIERS: SlaTier[] = ["95", "99", "99.9"];

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
    const stakes = await listStakesForUser(r.id.suiAddress!);
    return NextResponse.json({
      stakes: stakes.map((s) => ({
        stakeObjectId: s.stakeObjectId,
        serverObjectId: s.serverObjectId,
        amountAtomic: s.amountAtomic.toString(),
        remainingAtomic: s.remainingAtomic.toString(),
        slaUptimeX100: s.slaUptimeX100,
        txDigest: s.txDigest,
        createdAt: s.createdAt,
        slashes: s.slashes.map((sl) => ({
          amountAtomic: sl.amountAtomic.toString(),
          reason: sl.reason,
          slashedAt: sl.slashedAt,
          txDigest: sl.txDigest,
        })),
      })),
    });
  } catch {
    // Mirror unavailable in local dev — degrade gracefully.
    return NextResponse.json({ stakes: [] });
  }
}

function cfgOr503() {
  try {
    return { cfg: suiTxConfig(), platformConfigId: platformConfigId() };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "chain not configured",
    };
  }
}

export async function POST(req: NextRequest) {
  const r = await identityFromReq(req);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const body = (await req.json().catch(() => ({}))) as {
    serverObjectId?: string;
    amountUsd?: number;
    slaTier?: string;
    lockDurationDays?: number;
  };

  if (!body.serverObjectId || !body.serverObjectId.startsWith("0x")) {
    return NextResponse.json({ error: "serverObjectId required" }, { status: 400 });
  }
  const slaTier = body.slaTier as SlaTier | undefined;
  if (!slaTier || !VALID_TIERS.includes(slaTier)) {
    return NextResponse.json(
      { error: "slaTier must be one of 95 | 99 | 99.9" },
      { status: 400 },
    );
  }
  let stakeAtomic: bigint;
  try {
    stakeAtomic = usdToUsdsuiAtomic(Number(body.amountUsd));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bad amount" },
      { status: 400 },
    );
  }
  const lockDays = Number(body.lockDurationDays ?? 30);
  if (!Number.isFinite(lockDays) || lockDays <= 0) {
    return NextResponse.json({ error: "lockDurationDays must be > 0" }, { status: 400 });
  }
  const lockDurationMs = Math.trunc(lockDays * 24 * 60 * 60 * 1000);
  // The SLA is measured over the oracle's 6h window.
  const slaWindowSeconds = 6 * 60 * 60;

  const c = cfgOr503();
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: 503 });

  try {
    const built = await buildPostStakeTx({
      cfg: c.cfg,
      platformConfigId: c.platformConfigId,
      sender: r.id.suiAddress!,
      serverObjectId: body.serverObjectId,
      stakeAtomic,
      slaTier,
      slaWindowSeconds,
      lockDurationMs,
    });
    return NextResponse.json({ txBytesB64: built.txBytesB64 });
  } catch (e) {
    return NextResponse.json(
      { error: `tx build failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const r = await identityFromReq(req);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

  const body = (await req.json().catch(() => ({}))) as {
    stakeObjectId?: string;
    amountUsd?: number;
  };
  if (!body.stakeObjectId) {
    return NextResponse.json({ error: "stakeObjectId required" }, { status: 400 });
  }
  let amountAtomic: bigint;
  try {
    amountAtomic = usdToUsdsuiAtomic(Number(body.amountUsd));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bad amount" },
      { status: 400 },
    );
  }

  const c = cfgOr503();
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: 503 });

  try {
    const built = await buildTopUpStakeTx({
      cfg: c.cfg,
      sender: r.id.suiAddress!,
      stakeObjectId: body.stakeObjectId,
      amountAtomic,
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

  const body = (await req.json().catch(() => ({}))) as {
    stakeObjectId?: string;
    amountUsd?: number;
  };
  if (!body.stakeObjectId) {
    return NextResponse.json({ error: "stakeObjectId required" }, { status: 400 });
  }
  let amountAtomic: bigint;
  try {
    amountAtomic = usdToUsdsuiAtomic(Number(body.amountUsd));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bad amount" },
      { status: 400 },
    );
  }

  const c = cfgOr503();
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: 503 });

  try {
    const built = await buildWithdrawStakeTx({
      cfg: c.cfg,
      sender: r.id.suiAddress!,
      stakeObjectId: body.stakeObjectId,
      amountAtomic,
    });
    return NextResponse.json({ txBytesB64: built.txBytesB64 });
  } catch (e) {
    return NextResponse.json(
      { error: `tx build failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }
}
