/**
 * Server-side reads off the indexer mirror (ADR-011: never chain RPC on the
 * hot path). All amounts are atomic; convert at the view layer.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const toBig = (v: number | string | null | undefined): bigint =>
  v === null || v === undefined ? 0n : BigInt(typeof v === "number" ? Math.trunc(v) : v);

export interface SessionBalance {
  sessionObjectId: string;
  balanceAtomic: bigint;
  perCallCapAtomic: bigint;
  perDayCapAtomic: bigint;
  lifetimeDepositedAtomic: bigint;
  lifetimeSpentAtomic: bigint;
  active: boolean;
}

export async function getSessionBalance(
  suiAddress: string,
): Promise<SessionBalance | null> {
  const sb = createAdminClient();
  const { data } = (await sb
    .from("chain_balances")
    .select(
      "session_object_id, balance_atomic, per_call_cap_atomic, per_day_cap_atomic, lifetime_deposited_atomic, lifetime_spent_atomic, active",
    )
    .eq("owner_address", suiAddress)
    .eq("active", true)
    .order("last_synced_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: Record<string, unknown> | null };
  if (!data) return null;
  return {
    sessionObjectId: String(data.session_object_id),
    balanceAtomic: toBig(data.balance_atomic as string),
    perCallCapAtomic: toBig(data.per_call_cap_atomic as string),
    perDayCapAtomic: toBig(data.per_day_cap_atomic as string),
    lifetimeDepositedAtomic: toBig(data.lifetime_deposited_atomic as string),
    lifetimeSpentAtomic: toBig(data.lifetime_spent_atomic as string),
    active: Boolean(data.active),
  };
}

export interface ReceiptRow {
  id: string;
  toolName: string;
  namespace: string;
  status: string;
  amountAtomic: bigint;
  txDigest: string | null;
  receiptObjectId: string | null;
  receiptBlobId: string | null;
  createdAt: string;
}

export async function listReceipts(
  userId: string,
  limit = 100,
): Promise<ReceiptRow[]> {
  const sb = createAdminClient();
  const { data } = (await sb
    .from("request_log")
    .select(
      "id, tool_name, namespace, status, amount_atomic, tx_digest, receipt_object_id, receipt_blob_id, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)) as { data: Array<Record<string, unknown>> | null };
  return (data ?? []).map((r) => ({
    id: String(r.id),
    toolName: String(r.tool_name),
    namespace: String(r.namespace),
    status: String(r.status),
    amountAtomic: toBig(r.amount_atomic as string),
    txDigest: (r.tx_digest as string) ?? null,
    receiptObjectId: (r.receipt_object_id as string) ?? null,
    receiptBlobId: (r.receipt_blob_id as string) ?? null,
    createdAt: String(r.created_at),
  }));
}

export async function getReceipt(
  userId: string,
  receiptId: string,
): Promise<ReceiptRow | null> {
  const sb = createAdminClient();
  const { data } = (await sb
    .from("request_log")
    .select(
      "id, tool_name, namespace, status, amount_atomic, tx_digest, receipt_object_id, receipt_blob_id, created_at",
    )
    .eq("user_id", userId)
    .eq("id", receiptId)
    .maybeSingle()) as { data: Record<string, unknown> | null };
  if (!data) return null;
  return {
    id: String(data.id),
    toolName: String(data.tool_name),
    namespace: String(data.namespace),
    status: String(data.status),
    amountAtomic: toBig(data.amount_atomic as string),
    txDigest: (data.tx_digest as string) ?? null,
    receiptObjectId: (data.receipt_object_id as string) ?? null,
    receiptBlobId: (data.receipt_blob_id as string) ?? null,
    createdAt: String(data.created_at),
  };
}

export interface MarketplaceServer {
  objectId: string;
  namespace: string;
  name: string;
  description: string;
  category: string;
  endpointUrl: string | null;
  metadataBlobId: string | null;
  txDigest: string | null;
  toolCount: number;
}

function mapServer(d: Record<string, unknown>): MarketplaceServer {
  return {
    objectId: String(d.object_id),
    namespace: String(d.namespace),
    name: String(d.name ?? d.namespace),
    description: String(d.description ?? ""),
    category: String(d.category ?? "other"),
    endpointUrl: (d.endpoint_url as string) ?? null,
    metadataBlobId: (d.metadata_blob_id as string) ?? null,
    txDigest: (d.tx_digest as string) ?? null,
    toolCount: Number(d.tool_count ?? 0),
  };
}

export async function listMarketplaceServers(): Promise<MarketplaceServer[]> {
  const sb = createAdminClient();
  const { data } = (await sb
    .from("marketplace_servers")
    .select(
      "object_id, namespace, name, description, category, endpoint_url, metadata_blob_id, tx_digest, tool_count",
    )
    .order("tool_count", { ascending: false })) as {
    data: Array<Record<string, unknown>> | null;
  };
  return (data ?? []).map(mapServer);
}

export async function getMarketplaceServer(
  namespace: string,
): Promise<MarketplaceServer | null> {
  const sb = createAdminClient();
  const { data } = (await sb
    .from("marketplace_servers")
    .select(
      "object_id, namespace, name, description, category, endpoint_url, metadata_blob_id, tx_digest, tool_count",
    )
    .eq("namespace", namespace)
    .maybeSingle()) as { data: Record<string, unknown> | null };
  return data ? mapServer(data) : null;
}

export async function getPlatformTotals(): Promise<{
  cumulativeSettledAtomic: bigint;
  callsToday: number;
}> {
  const sb = createAdminClient();
  const { data } = (await sb
    .from("dashboard_usage")
    .select("calls, gross_atomic")) as {
    data: Array<{ calls: number | null; gross_atomic: number | string | null }> | null;
  };
  let gross = 0n;
  let calls = 0;
  for (const r of data ?? []) {
    gross += toBig(r.gross_atomic);
    calls += Number(r.calls ?? 0);
  }
  return { cumulativeSettledAtomic: gross, callsToday: calls };
}

export interface BundleRow {
  id: string;
  name: string | null;
  creator: string;
  serverCount: number;
  priceMultiplierX100: number;
  /** Whole-percent discount derived from the multiplier (90 → 10). */
  discountPct: number;
  metadataBlobId: string | null;
  active: boolean;
  txDigest: string | null;
  createdAt: string;
}

function mapBundle(d: Record<string, unknown>): BundleRow {
  const mult = Number(d.price_multiplier_x100 ?? 100);
  return {
    id: String(d.bundle_object_id),
    name: (d.name as string) ?? null,
    creator: String(d.creator_address ?? ""),
    serverCount: Number(d.server_count ?? 0),
    priceMultiplierX100: mult,
    discountPct:
      typeof d.discount_pct === "number"
        ? d.discount_pct
        : Math.max(0, 100 - mult),
    metadataBlobId: (d.metadata_blob_id as string) ?? null,
    active: d.active === undefined ? true : Boolean(d.active),
    txDigest: (d.tx_digest as string) ?? null,
    createdAt: String(d.created_at ?? ""),
  };
}

// S5-T17/T19: read the indexer mirror (bundles_public view from migration
// 009), never chain RPC. Indexer-written only — the web never writes here.
export async function listBundles(): Promise<BundleRow[]> {
  const sb = createAdminClient();
  const { data } = (await sb
    .from("bundles_public")
    .select(
      "bundle_object_id, name, creator_address, server_count, price_multiplier_x100, metadata_blob_id, active, tx_digest, created_at, discount_pct",
    )
    .eq("active", true)
    .order("created_at", { ascending: false })) as {
    data: Array<Record<string, unknown>> | null;
  };
  return (data ?? []).map(mapBundle);
}

export async function getBundle(id: string): Promise<BundleRow | null> {
  const sb = createAdminClient();
  const { data } = (await sb
    .from("bundles_public")
    .select(
      "bundle_object_id, name, creator_address, server_count, price_multiplier_x100, metadata_blob_id, active, tx_digest, created_at, discount_pct",
    )
    .eq("bundle_object_id", id)
    .maybeSingle()) as { data: Record<string, unknown> | null };
  return data ? mapBundle(data) : null;
}

export function usdsui(atomic: bigint): string {
  const whole = atomic / 1_000_000n;
  const frac = (atomic % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `${whole.toString()}.${frac}`;
}
