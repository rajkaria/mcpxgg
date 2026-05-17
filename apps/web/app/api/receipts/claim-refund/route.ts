import { NextRequest, NextResponse } from "next/server";
import { buildClaimFailedCallTx } from "@mcpxgg/chain";
import { verifyPrivyToken } from "@/lib/privy/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getReceipt } from "@/lib/chain/reads";
import { suiTxConfig, insurancePoolId } from "@/lib/chain/config";

/**
 * S7-T15. Failed-call refund claim. Builds the
 * `mcpx::settlement::claim_for_failed_call` PTB for the receipt payer's Privy
 * embedded wallet to sign+submit. Permissionless on-chain but the Move call
 * asserts the signer is the receipt payer — so we still authenticate and only
 * build for receipts THIS user owns and that are still claimable.
 *
 * Mirrors the SpendingIntents pattern (S6-T05): server builds BCS bytes only;
 * the embedded wallet signs+submits; the indexer flips request_log.refunded
 * once the RefundIssued event indexes (the web never writes that mirror).
 */
export async function POST(req: NextRequest) {
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
    suiAddress = id.suiAddress;
  } catch {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  // Resolve the receipt under the signed-in app user so we never build a
  // claim for someone else's receipt.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { receiptId?: string };
  if (!body.receiptId) {
    return NextResponse.json(
      { error: "receiptId required" },
      { status: 400 },
    );
  }

  const receipt = await getReceipt(user.id, body.receiptId);
  if (!receipt) {
    return NextResponse.json({ error: "receipt not found" }, { status: 404 });
  }
  if (!receipt.receiptObjectId) {
    return NextResponse.json(
      { error: "receipt not yet on-chain (no receipt object)" },
      { status: 409 },
    );
  }
  if (!receipt.claimable) {
    return NextResponse.json(
      {
        error: receipt.refunded
          ? "already refunded"
          : "only failed calls can be refunded",
      },
      { status: 409 },
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
    const built = await buildClaimFailedCallTx({
      cfg,
      sender: suiAddress!,
      receiptObjectId: receipt.receiptObjectId,
      insurancePoolId: poolId,
    });
    return NextResponse.json({ txBytesB64: built.txBytesB64 });
  } catch (e) {
    return NextResponse.json(
      { error: `tx build failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }
}
