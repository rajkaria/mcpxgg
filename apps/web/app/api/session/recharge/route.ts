import { NextRequest, NextResponse } from "next/server";
import {
  buildCreateSessionAndDepositTx,
  buildDepositTx,
} from "@mcpxgg/chain";
import { verifyPrivyToken } from "@/lib/privy/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { suiTxConfig, usdToUsdsuiAtomic } from "@/lib/chain/config";

/**
 * S4-T06 + S4-T07: build the recharge PTB for the user's wallet to sign.
 * If the user has no active Session, the PTB is createSession+deposit in
 * one tx; otherwise it's a deposit into the existing Session. The server
 * never signs — it returns BCS bytes the Privy embedded wallet signs.
 */
export async function POST(req: NextRequest) {
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.toLowerCase().startsWith("bearer ")
    ? authz.slice(7).trim()
    : "";
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 401 });

  let identity;
  try {
    identity = await verifyPrivyToken(token);
  } catch {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }
  if (!identity.suiAddress) {
    return NextResponse.json(
      { error: "no Sui wallet linked to this account" },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    usdAmount?: number;
    perCallCapAtomic?: string;
    perDayCapAtomic?: string;
  };
  let amountAtomic: bigint;
  try {
    amountAtomic = usdToUsdsuiAtomic(Number(body.usdAmount));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "bad amount" },
      { status: 400 },
    );
  }

  const sb = createAdminClient();
  const { data: session } = (await sb
    .from("chain_balances")
    .select("session_object_id")
    .eq("owner_address", identity.suiAddress)
    .eq("active", true)
    .order("last_synced_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: { session_object_id: string } | null };

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
    const built = session
      ? await buildDepositTx({
          cfg,
          sender: identity.suiAddress,
          sessionObjectId: session.session_object_id,
          amountAtomic,
        })
      : await buildCreateSessionAndDepositTx({
          cfg,
          sender: identity.suiAddress,
          initialDepositAtomic: amountAtomic,
          ...(body.perCallCapAtomic
            ? { perCallCapAtomic: BigInt(body.perCallCapAtomic) }
            : {}),
          ...(body.perDayCapAtomic
            ? { perDayCapAtomic: BigInt(body.perDayCapAtomic) }
            : {}),
        });
    return NextResponse.json({
      kind: session ? "deposit" : "create_session",
      amountAtomic: amountAtomic.toString(),
      txBytesB64: built.txBytesB64,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `tx build failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }
}
