import { NextRequest, NextResponse } from "next/server";
import { buildTopUpInsuranceTx } from "@mcpxgg/chain";
import { verifyPrivyToken } from "@/lib/privy/server";
import { requireAdmin, adminEmails } from "@/lib/auth/admin";
import { getInsuranceOverview } from "@/lib/chain/reads";
import {
  suiTxConfig,
  insurancePoolId,
  usdToUsdsuiAtomic,
} from "@/lib/chain/config";

/**
 * S7-T18. Insurance-fund admin: top up the on-chain pool from sponsor
 * donations. Admin-gated TWICE — the session cookie must be an admin
 * (requireAdmin), and the Privy bearer (whose embedded wallet signs the
 * top_up PTB) must ALSO be on the ADMIN_EMAILS allowlist, so a non-admin
 * wallet can never be coaxed into building a sponsor tx.
 *
 * Like every other PTB route the server only builds BCS bytes; the admin's
 * embedded wallet signs+submits; the indexer mirrors InsuranceCollected into
 * `insurance_contributions` (the web never writes that mirror).
 */

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const overview = await getInsuranceOverview();
    return NextResponse.json({
      balanceAtomic: overview.balanceAtomic.toString(),
      lifetimeCollectedAtomic: overview.lifetimeCollectedAtomic.toString(),
      lifetimePaidAtomic: overview.lifetimePaidAtomic.toString(),
      poolObjectId: overview.poolObjectId,
    });
  } catch {
    return NextResponse.json({
      balanceAtomic: "0",
      lifetimeCollectedAtomic: "0",
      lifetimePaidAtomic: "0",
      poolObjectId: null,
    });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const authz = req.headers.get("authorization") ?? "";
  const token = authz.toLowerCase().startsWith("bearer ")
    ? authz.slice(7).trim()
    : "";
  if (!token) {
    return NextResponse.json({ error: "missing token" }, { status: 401 });
  }

  let suiAddress: string | undefined;
  try {
    const id = await verifyPrivyToken(token);
    if (!id.suiAddress) {
      return NextResponse.json(
        { error: "no Sui wallet linked to this account" },
        { status: 400 },
      );
    }
    // Defence in depth: the signing wallet's account must itself be an admin.
    const allow = adminEmails();
    if (
      allow.length === 0 ||
      !id.email ||
      !allow.includes(id.email.toLowerCase())
    ) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    suiAddress = id.suiAddress;
  } catch {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { amountUsd?: number };
  let amountAtomic: bigint;
  try {
    amountAtomic = usdToUsdsuiAtomic(Number(body.amountUsd));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bad amount" },
      { status: 400 },
    );
  }

  let cfg;
  let poolId: string;
  try {
    cfg = suiTxConfig();
    poolId = insurancePoolId();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "chain not configured" },
      { status: 503 },
    );
  }

  try {
    const built = await buildTopUpInsuranceTx({
      cfg,
      sender: suiAddress!,
      insurancePoolId: poolId,
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
