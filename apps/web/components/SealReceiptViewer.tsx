"use client";

/**
 * S4-T11: Seal-encrypted receipt viewer. Real Seal (threshold IBE) lands in
 * a later sprint; today blobs use the plaintext-passthrough envelope, so
 * "decrypt" just unwraps it. The two buttons model the eventual
 * caller-vs-server-owner key paths.
 */

import { useState } from "react";
import { sealDecrypt, type SealEnvelope } from "@mcpxgg/walrus";

export function SealReceiptViewer({ envelope }: { envelope: SealEnvelope }) {
  const [plain, setPlain] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function decrypt(as: "caller" | "server_owner") {
    try {
      const bytes = sealDecrypt(envelope);
      setPlain(new TextDecoder().decode(bytes));
      setErr(null);
    } catch (e) {
      setErr(`${as}: ${e instanceof Error ? e.message : "decrypt failed"}`);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <div className="mb-2 text-sm">
        Encrypted receipt ({envelope.scheme}). Recipients:{" "}
        <code className="text-xs">{envelope.recipients.join(", ") || "—"}</code>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-ghost text-sm" onClick={() => decrypt("caller")}>
          Decrypt as caller
        </button>
        <button
          className="btn btn-ghost text-sm"
          onClick={() => decrypt("server_owner")}
        >
          Decrypt as server owner
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
      {plain && (
        <pre className="mt-3 overflow-x-auto rounded bg-black/30 p-3 text-xs">
          {plain}
        </pre>
      )}
    </div>
  );
}
