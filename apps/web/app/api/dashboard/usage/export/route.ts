import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listReceipts, usdsui } from "@/lib/chain/reads";

/** S4-T17: CSV export of the caller's CallReceipts (request_log mirror). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const rows = await listReceipts(user.id, 10_000);
  const header = [
    "created_at",
    "namespace",
    "tool",
    "status",
    "amount_usdsui",
    "amount_atomic",
    "tx_digest",
    "receipt_object_id",
    "receipt_blob_id",
  ];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.createdAt,
        r.namespace,
        r.toolName,
        r.status,
        usdsui(r.amountAtomic),
        r.amountAtomic.toString(),
        r.txDigest ?? "",
        r.receiptObjectId ?? "",
        r.receiptBlobId ?? "",
      ]
        .map((c) => esc(String(c)))
        .join(","),
    );
  }
  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="mcpxgg-usage.csv"`,
    },
  });
}
