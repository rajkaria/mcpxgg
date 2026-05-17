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
  /** S7-T15: failed-call refund state (mirrored from RefundIssued). */
  refunded: boolean;
  refundAmountAtomic: bigint;
  /** A failed call is claimable from insurance iff !success && !refunded. */
  claimable: boolean;
}

function mapReceipt(d: Record<string, unknown>): ReceiptRow {
  const status = String(d.status);
  const refunded = Boolean(d.refunded);
  return {
    id: String(d.id),
    toolName: String(d.tool_name),
    namespace: String(d.namespace),
    status,
    amountAtomic: toBig(d.amount_atomic as string),
    txDigest: (d.tx_digest as string) ?? null,
    receiptObjectId: (d.receipt_object_id as string) ?? null,
    receiptBlobId: (d.receipt_blob_id as string) ?? null,
    createdAt: String(d.created_at),
    refunded,
    refundAmountAtomic: toBig(d.refund_amount_atomic as string),
    claimable: status !== "success" && !refunded,
  };
}

export async function listReceipts(
  userId: string,
  limit = 100,
): Promise<ReceiptRow[]> {
  const sb = createAdminClient();
  // `*` (not a named projection) so this still works pre-migration-015 —
  // the refund columns are added by a parallel workstream's deploy.
  const { data } = (await sb
    .from("request_log")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)) as { data: Array<Record<string, unknown>> | null };
  return (data ?? []).map(mapReceipt);
}

export async function getReceipt(
  userId: string,
  receiptId: string,
): Promise<ReceiptRow | null> {
  const sb = createAdminClient();
  const { data } = (await sb
    .from("request_log")
    .select("*")
    .eq("user_id", userId)
    .eq("id", receiptId)
    .maybeSingle()) as { data: Record<string, unknown> | null };
  return data ? mapReceipt(data) : null;
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
  /** Latest on-chain quality score ×100 (0..10000), null if unattested. */
  qualityScoreX100: number | null;
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
    qualityScoreX100:
      d.latest_quality_x100 == null ? null : Number(d.latest_quality_x100),
  };
}

export async function listMarketplaceServers(): Promise<MarketplaceServer[]> {
  const sb = createAdminClient();
  const { data } = (await sb
    .from("marketplace_servers")
    .select(
      "object_id, namespace, name, description, category, endpoint_url, metadata_blob_id, tx_digest, tool_count, latest_quality_x100",
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
      "object_id, namespace, name, description, category, endpoint_url, metadata_blob_id, tx_digest, tool_count, latest_quality_x100",
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

// ─── S6-T05: SpendingIntents (read the `intents` mirror only) ────────────

export interface IntentRow {
  intentObjectId: string;
  userAddress: string;
  agentAddress: string;
  dailyCapAtomic: bigint;
  perCallCapAtomic: bigint;
  allowedCategories: string[];
  serverIds: string[];
  expiresAtMs: bigint;
  todaySpentAtomic: bigint;
  lifetimeSpentAtomic: bigint;
  status: string;
  txDigest: string | null;
  createdAt: string;
}

export async function listIntentsForUser(
  userAddress: string,
): Promise<IntentRow[]> {
  const sb = createAdminClient();
  // A parallel migration adds per_call_cap_atomic/allowed_categories/server_ids
  // + spend counters; select defensively so this never 500s pre-migration.
  const { data } = (await sb
    .from("intents")
    .select("*")
    .eq("user_address", userAddress)
    .order("created_at", { ascending: false })) as {
    data: Array<Record<string, unknown>> | null;
  };
  return (data ?? []).map((d) => {
    const cats = d.allowed_categories;
    const sids = d.server_ids;
    return {
      intentObjectId: String(d.intent_object_id),
      userAddress: String(d.user_address),
      agentAddress: String(d.agent_address),
      dailyCapAtomic: toBig(d.daily_cap_atomic as string),
      perCallCapAtomic: toBig(d.per_call_cap_atomic as string),
      allowedCategories: Array.isArray(cats) ? (cats as string[]) : [],
      serverIds: Array.isArray(sids) ? (sids as string[]) : [],
      expiresAtMs: toBig(d.expires_at_ms as string),
      todaySpentAtomic: toBig(d.today_spent as string),
      lifetimeSpentAtomic: toBig(d.lifetime_spent as string),
      status: String(d.status ?? "active"),
      txDigest: (d.tx_digest as string) ?? null,
      createdAt: String(d.created_at ?? ""),
    };
  });
}

// ─── S7-T10/T11/T12: SLA staking (read the `stakes`/`stake_slashes` mirror) ─

export interface StakeSlashRow {
  amountAtomic: bigint;
  reason: string;
  slashedAt: string;
  txDigest: string | null;
}

export interface ServerStakeRow {
  stakeObjectId: string;
  serverObjectId: string;
  ownerAddress: string;
  /** Original posted stake. */
  amountAtomic: bigint;
  /** amountAtomic minus the sum of all slashes. */
  remainingAtomic: bigint;
  /** Committed SLA uptime ×100 (9500 | 9900 | 9990). */
  slaUptimeX100: number;
  txDigest: string | null;
  createdAt: string;
  slashes: StakeSlashRow[];
}

function slaTierLabel(slaUptimeX100: number): string {
  if (slaUptimeX100 >= 9990) return "99.9";
  if (slaUptimeX100 >= 9900) return "99";
  return "95";
}

export function slaTierFromX100(slaUptimeX100: number): string {
  return slaTierLabel(slaUptimeX100);
}

async function loadStakeSlashes(
  stakeObjectIds: string[],
): Promise<Record<string, StakeSlashRow[]>> {
  if (stakeObjectIds.length === 0) return {};
  const sb = createAdminClient();
  const { data } = (await sb
    .from("stake_slashes")
    .select("stake_object_id, amount_atomic, reason, slashed_at, tx_digest")
    .in("stake_object_id", stakeObjectIds)
    .order("slashed_at", { ascending: false })) as {
    data: Array<Record<string, unknown>> | null;
  };
  const out: Record<string, StakeSlashRow[]> = {};
  for (const r of data ?? []) {
    const id = String(r.stake_object_id);
    (out[id] ??= []).push({
      amountAtomic: toBig(r.amount_atomic as string),
      reason: String(r.reason ?? ""),
      slashedAt: String(r.slashed_at ?? ""),
      txDigest: (r.tx_digest as string) ?? null,
    });
  }
  return out;
}

function mapStake(
  d: Record<string, unknown>,
  slashes: StakeSlashRow[],
): ServerStakeRow {
  const amount = toBig(d.amount_atomic as string);
  const slashedTotal = slashes.reduce((a, s) => a + s.amountAtomic, 0n);
  const remaining = amount - slashedTotal;
  return {
    stakeObjectId: String(d.stake_object_id),
    serverObjectId: String(d.server_object_id),
    ownerAddress: String(d.owner_address ?? ""),
    amountAtomic: amount,
    remainingAtomic: remaining > 0n ? remaining : 0n,
    slaUptimeX100: Number(d.sla_uptime_x100 ?? 0),
    txDigest: (d.tx_digest as string) ?? null,
    createdAt: String(d.created_at ?? ""),
    slashes,
  };
}

/** All stakes posted by a developer (their dashboard view). */
export async function listStakesForUser(
  ownerAddress: string,
): Promise<ServerStakeRow[]> {
  const sb = createAdminClient();
  const { data } = (await sb
    .from("stakes")
    .select(
      "stake_object_id, server_object_id, owner_address, amount_atomic, sla_uptime_x100, tx_digest, created_at",
    )
    .eq("owner_address", ownerAddress)
    .order("created_at", { ascending: false })) as {
    data: Array<Record<string, unknown>> | null;
  };
  const rows = data ?? [];
  const byStake = await loadStakeSlashes(
    rows.map((r) => String(r.stake_object_id)),
  );
  return rows.map((r) =>
    mapStake(r, byStake[String(r.stake_object_id)] ?? []),
  );
}

/** Active (non-zero remaining) stake for a server, if any — for the badge. */
export async function getServerStake(
  serverObjectId: string,
): Promise<ServerStakeRow | null> {
  const sb = createAdminClient();
  const { data } = (await sb
    .from("stakes")
    .select(
      "stake_object_id, server_object_id, owner_address, amount_atomic, sla_uptime_x100, tx_digest, created_at",
    )
    .eq("server_object_id", serverObjectId)
    .order("created_at", { ascending: false })) as {
    data: Array<Record<string, unknown>> | null;
  };
  const rows = data ?? [];
  if (rows.length === 0) return null;
  const byStake = await loadStakeSlashes(
    rows.map((r) => String(r.stake_object_id)),
  );
  const mapped = rows.map((r) =>
    mapStake(r, byStake[String(r.stake_object_id)] ?? []),
  );
  // Highest committed SLA among still-funded stakes; else the latest stake.
  const funded = mapped.filter((m) => m.remainingAtomic > 0n);
  if (funded.length === 0) return mapped[0] ?? null;
  return funded.sort(
    (a, b) =>
      b.slaUptimeX100 - a.slaUptimeX100 ||
      (b.remainingAtomic > a.remainingAtomic ? 1 : -1),
  )[0]!;
}

/** Set of serverObjectIds that currently have a funded stake (T12 filter). */
export async function listStakedServerIds(): Promise<Set<string>> {
  const sb = createAdminClient();
  const { data } = (await sb
    .from("stakes")
    .select("stake_object_id, server_object_id, amount_atomic")) as {
    data: Array<Record<string, unknown>> | null;
  };
  const rows = data ?? [];
  if (rows.length === 0) return new Set();
  const byStake = await loadStakeSlashes(
    rows.map((r) => String(r.stake_object_id)),
  );
  const ids = new Set<string>();
  for (const r of rows) {
    const amount = toBig(r.amount_atomic as string);
    const slashed = (byStake[String(r.stake_object_id)] ?? []).reduce(
      (a, s) => a + s.amountAtomic,
      0n,
    );
    if (amount - slashed > 0n) ids.add(String(r.server_object_id));
  }
  return ids;
}

// ─── S6-T19: latest quality attestation per server ───────────────────────

export interface QualityScore {
  scoreX100: number;
  uptimeX100: number;
  p95LatencyMs: number;
  errorRateX100: number;
  attestedAtMs: number;
}

function mapQuality(d: Record<string, unknown>): QualityScore {
  return {
    scoreX100: Number(d.score_x100 ?? 0),
    uptimeX100: Number(d.uptime_x100 ?? 0),
    p95LatencyMs: Number(d.p95_latency_ms ?? 0),
    errorRateX100: Number(d.error_rate_x100 ?? 0),
    attestedAtMs: Number(d.attested_at_ms ?? 0),
  };
}

export async function getLatestQuality(
  serverObjectId: string,
): Promise<QualityScore | null> {
  const sb = createAdminClient();
  const { data } = (await sb
    .from("quality_attestations")
    .select(
      "score_x100, uptime_x100, p95_latency_ms, error_rate_x100, attested_at_ms",
    )
    .eq("server_object_id", serverObjectId)
    .order("attested_at_ms", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: Record<string, unknown> | null };
  return data ? mapQuality(data) : null;
}

export async function getLatestQualityMap(
  serverObjectIds: string[],
): Promise<Record<string, QualityScore>> {
  if (serverObjectIds.length === 0) return {};
  const sb = createAdminClient();
  const { data } = (await sb
    .from("quality_attestations")
    .select(
      "server_object_id, score_x100, uptime_x100, p95_latency_ms, error_rate_x100, attested_at_ms",
    )
    .in("server_object_id", serverObjectIds)
    .order("attested_at_ms", { ascending: false })) as {
    data: Array<Record<string, unknown>> | null;
  };
  const out: Record<string, QualityScore> = {};
  for (const r of data ?? []) {
    const id = String(r.server_object_id);
    if (!out[id]) out[id] = mapQuality(r);
  }
  return out;
}

// ─── S6-T14/T16: /live feed + cumulative metrics ─────────────────────────

export interface LiveFeedRow {
  txDigest: string;
  serverObjectId: string | null;
  serverName: string | null;
  namespace: string | null;
  toolName: string;
  payerAddress: string | null;
  amountAtomic: bigint;
  createdAt: string;
}

export async function listLiveFeed(limit = 60): Promise<LiveFeedRow[]> {
  const sb = createAdminClient();
  const { data } = (await sb
    .from("live_feed_24h")
    .select(
      "tx_digest, server_object_id, server_name, namespace, tool_name, payer_address, amount_atomic, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit)) as { data: Array<Record<string, unknown>> | null };
  return (data ?? []).map((r) => ({
    txDigest: String(r.tx_digest),
    serverObjectId: (r.server_object_id as string) ?? null,
    serverName: (r.server_name as string) ?? null,
    namespace: (r.namespace as string) ?? null,
    toolName: String(r.tool_name ?? ""),
    payerAddress: (r.payer_address as string) ?? null,
    amountAtomic: toBig(r.amount_atomic as string),
    createdAt: String(r.created_at),
  }));
}

export interface LiveMetrics {
  totalCalls: number;
  totalSettledAtomic: bigint;
  activeServers: number;
  activeUsers: number;
  topServers: Array<{ name: string; namespace: string | null; calls: number }>;
  activeUserList: Array<{ address: string; calls: number }>;
}

export async function getLiveMetrics(): Promise<LiveMetrics> {
  const rows = await listLiveFeed(1000);
  let totalSettled = 0n;
  const byServer = new Map<string, { name: string; namespace: string | null; calls: number }>();
  const byUser = new Map<string, number>();
  for (const r of rows) {
    totalSettled += r.amountAtomic;
    const sk = r.serverObjectId ?? r.serverName ?? r.namespace ?? "unknown";
    const cur = byServer.get(sk) ?? {
      name: r.serverName ?? r.namespace ?? "unknown",
      namespace: r.namespace,
      calls: 0,
    };
    cur.calls += 1;
    byServer.set(sk, cur);
    if (r.payerAddress) byUser.set(r.payerAddress, (byUser.get(r.payerAddress) ?? 0) + 1);
  }
  const topServers = [...byServer.values()]
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 8);
  const activeUserList = [...byUser.entries()]
    .map(([address, calls]) => ({ address, calls }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 8);
  return {
    totalCalls: rows.length,
    totalSettledAtomic: totalSettled,
    activeServers: byServer.size,
    activeUsers: byUser.size,
    topServers,
    activeUserList,
  };
}

// ─── S6-T25: app-owned featured rotation (NOT a mirror table) ────────────

export interface FeaturedRow {
  serverObjectId: string;
  weekStart: string;
  position: number;
}

export async function listCurrentFeatured(): Promise<FeaturedRow[]> {
  const sb = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = (await sb
    .from("featured_servers")
    .select("server_object_id, week_start, position")
    .lte("week_start", today)
    .order("week_start", { ascending: false })
    .order("position", { ascending: true })) as {
    data: Array<Record<string, unknown>> | null;
  };
  const rows = (data ?? []).map((d) => ({
    serverObjectId: String(d.server_object_id),
    weekStart: String(d.week_start),
    position: Number(d.position ?? 0),
  }));
  if (rows.length === 0) return [];
  const latestWeek = rows[0]!.weekStart;
  return rows.filter((r) => r.weekStart === latestWeek);
}

// ─── S7-T16: insurance pool transparency dashboard (mirror reads only) ────

export interface InsuranceOverview {
  /** Live pool balance. */
  balanceAtomic: bigint;
  /** All-time inflow (take-rate + sponsor top-ups + slashes). */
  lifetimeCollectedAtomic: bigint;
  /** All-time refunds paid out for failed calls. */
  lifetimePaidAtomic: bigint;
  poolObjectId: string | null;
}

// The indexer keeps `platform_state`.insurance_balance_atomic /
// insurance_lifetime_atomic / insurance_paid_atomic in sync from
// InsuranceCollected/InsurancePaid events (apps/indexer handlers/insurance.ts).
// The web only reads.
export async function getInsuranceOverview(): Promise<InsuranceOverview> {
  const sb = createAdminClient();
  const { data } = (await sb
    .from("platform_state")
    .select(
      "insurance_object_id, insurance_balance_atomic, insurance_lifetime_atomic, insurance_paid_atomic",
    )
    .eq("chain_id", "sui")
    .maybeSingle()) as { data: Record<string, unknown> | null };
  return {
    balanceAtomic: toBig(data?.insurance_balance_atomic as string),
    lifetimeCollectedAtomic: toBig(data?.insurance_lifetime_atomic as string),
    lifetimePaidAtomic: toBig(data?.insurance_paid_atomic as string),
    poolObjectId: (data?.insurance_object_id as string) ?? null,
  };
}

export interface InsurancePayoutRow {
  originalReceiptId: string;
  payeeAddress: string | null;
  refundAmountAtomic: bigint;
  timestampMs: number;
  txDigest: string;
}

// Rows here are mirrored 1:1 from on-chain RefundIssued events into
// `insurance_payouts` by the indexer (handlers/settlement.ts → storage
// markRequestRefunded, migration 016). Indexer-written only.
export async function listInsurancePayouts(
  limit = 25,
): Promise<InsurancePayoutRow[]> {
  const sb = createAdminClient();
  const { data } = (await sb
    .from("insurance_payouts")
    .select(
      "original_receipt_id, payee_address, refund_amount_atomic, timestamp_ms, tx_digest",
    )
    .order("timestamp_ms", { ascending: false })
    .limit(limit)) as { data: Array<Record<string, unknown>> | null };
  return (data ?? []).map((r) => ({
    originalReceiptId: String(r.original_receipt_id),
    payeeAddress: (r.payee_address as string) ?? null,
    refundAmountAtomic: toBig(r.refund_amount_atomic as string),
    timestampMs: Number(r.timestamp_ms ?? 0),
    txDigest: String(r.tx_digest ?? ""),
  }));
}

export interface InsuranceContributorRow {
  contributorAddress: string;
  totalAtomic: bigint;
  contributionCount: number;
  lastContributedMs: number;
}

// `insurance_top_contributors` rolls up `insurance_contributions`. NOTE: the
// on-chain InsuranceCollected event carries only an amount (no contributor
// address), so named-contributor attribution is not derivable from events
// today — this view stays empty until a contributor-bearing event exists.
// The page degrades gracefully to an empty list.
export async function listInsuranceTopContributors(
  limit = 15,
): Promise<InsuranceContributorRow[]> {
  const sb = createAdminClient();
  const { data } = (await sb
    .from("insurance_top_contributors")
    .select(
      "contributor_address, total_atomic, contribution_count, last_contributed_ms",
    )
    .order("total_atomic", { ascending: false })
    .limit(limit)) as { data: Array<Record<string, unknown>> | null };
  return (data ?? []).map((r) => ({
    contributorAddress: String(r.contributor_address),
    totalAtomic: toBig(r.total_atomic as string),
    contributionCount: Number(r.contribution_count ?? 0),
    lastContributedMs: Number(r.last_contributed_ms ?? 0),
  }));
}
