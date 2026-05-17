import { NextRequest, NextResponse } from "next/server";
import { buildActivateBundleTx } from "@mcpxgg/chain";
import { verifyPrivyToken } from "@/lib/privy/server";
import { suiTxConfig } from "@/lib/chain/config";
import { getBundle } from "@/lib/chain/reads";

/**
 * S5-T16 + S5-T18: build the bundle-activation PTB for the user's wallet to
 * sign. Mirrors /api/session/recharge — the server only assembles BCS bytes
 * (mcpx::bundle::activate_for_user); the Privy embedded wallet signs+submits.
 * The server never holds the key and never writes the mirror (ADR-011).
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
    bundleObjectId?: string;
  };
  const bundleObjectId = (body.bundleObjectId ?? "").trim();
  if (!bundleObjectId.startsWith("0x")) {
    return NextResponse.json(
      { error: "bundleObjectId (0x…) required" },
      { status: 400 },
    );
  }

  // The bundle must exist in the indexer mirror before it can be activated —
  // it cannot be activated until S5-T19's on-chain seed lands.
  const bundle = await getBundle(bundleObjectId);
  if (!bundle) {
    return NextResponse.json(
      {
        error:
          "bundle not yet on-chain (seeding is gated on the S5-T22 mainnet deploy)",
      },
      { status: 409 },
    );
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
    const built = await buildActivateBundleTx({
      cfg,
      sender: identity.suiAddress,
      bundleObjectId,
    });
    return NextResponse.json({
      kind: "activate_bundle",
      bundleObjectId,
      txBytesB64: built.txBytesB64,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `tx build failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }
}
