/**
 * Session PTB builders (S4-T07). These return base64 transaction bytes the
 * browser hands to Privy's embedded wallet to sign — the gateway/web never
 * holds the user's key. @mysten/sui is lazy-loaded so type-only consumers
 * and the test path don't need the SDK resolved.
 *
 * Move entry points (contracts/sources/session.move):
 *   mcpx::session::create_session<T>(registry, init_coin, per_call_cap,
 *                                    per_day_cap, clock, ctx)
 *   mcpx::session::deposit<T>(session, coin)
 *   mcpx::session::withdraw<T>(session, amount, ctx)
 */

export interface SuiTxConfig {
  packageId: string;
  /** USDsui coin type tag, e.g. 0x..::usdsui::USDSUI */
  coinType: string;
  /** NamespaceRegistry / session registry shared object id. */
  sessionRegistryId: string;
  rpcUrl: string;
}

export interface BuiltTx {
  /** Base64 BCS-serialized TransactionData, ready for wallet signing. */
  txBytesB64: string;
}

async function sui() {
  const [{ Transaction }, { SuiClient }] = await Promise.all([
    import('@mysten/sui/transactions'),
    import('@mysten/sui/client'),
  ]);
  return { Transaction, SuiClient };
}

/** Pick USDsui coins owned by `sender` summing ≥ amount; merge+split to exact. */
async function coinInput(
  tx: import('@mysten/sui/transactions').Transaction,
  client: import('@mysten/sui/client').SuiClient,
  sender: string,
  coinType: string,
  amountAtomic: bigint,
) {
  const { data } = await client.getCoins({ owner: sender, coinType });
  if (data.length === 0) throw new Error(`no ${coinType} coins for ${sender}`);
  const primary = tx.object(data[0]!.coinObjectId);
  if (data.length > 1) {
    tx.mergeCoins(
      primary,
      data.slice(1).map((c) => tx.object(c.coinObjectId)),
    );
  }
  const [exact] = tx.splitCoins(primary, [tx.pure.u64(amountAtomic)]);
  return exact;
}

export async function buildCreateSessionAndDepositTx(args: {
  cfg: SuiTxConfig;
  sender: string;
  initialDepositAtomic: bigint;
  perCallCapAtomic?: bigint;
  perDayCapAtomic?: bigint;
}): Promise<BuiltTx> {
  const { Transaction, SuiClient } = await sui();
  const client = new SuiClient({ url: args.cfg.rpcUrl });
  const tx = new Transaction();
  tx.setSender(args.sender);
  const coin = await coinInput(
    tx,
    client,
    args.sender,
    args.cfg.coinType,
    args.initialDepositAtomic,
  );
  tx.moveCall({
    target: `${args.cfg.packageId}::session::create_session`,
    typeArguments: [args.cfg.coinType],
    arguments: [
      tx.object(args.cfg.sessionRegistryId),
      coin,
      tx.pure.u64(args.perCallCapAtomic ?? BigInt(0)),
      tx.pure.u64(args.perDayCapAtomic ?? BigInt(0)),
      tx.object('0x6'), // Clock
    ],
  });
  const txBytes = await tx.build({ client });
  return { txBytesB64: Buffer.from(txBytes).toString('base64') };
}

export async function buildDepositTx(args: {
  cfg: SuiTxConfig;
  sender: string;
  sessionObjectId: string;
  amountAtomic: bigint;
}): Promise<BuiltTx> {
  const { Transaction, SuiClient } = await sui();
  const client = new SuiClient({ url: args.cfg.rpcUrl });
  const tx = new Transaction();
  tx.setSender(args.sender);
  const coin = await coinInput(
    tx,
    client,
    args.sender,
    args.cfg.coinType,
    args.amountAtomic,
  );
  tx.moveCall({
    target: `${args.cfg.packageId}::session::deposit`,
    typeArguments: [args.cfg.coinType],
    arguments: [tx.object(args.sessionObjectId), coin],
  });
  const txBytes = await tx.build({ client });
  return { txBytesB64: Buffer.from(txBytes).toString('base64') };
}

export async function buildWithdrawTx(args: {
  cfg: SuiTxConfig;
  sender: string;
  sessionObjectId: string;
  amountAtomic: bigint;
}): Promise<BuiltTx> {
  const { Transaction, SuiClient } = await sui();
  const client = new SuiClient({ url: args.cfg.rpcUrl });
  const tx = new Transaction();
  tx.setSender(args.sender);
  tx.moveCall({
    target: `${args.cfg.packageId}::session::withdraw`,
    typeArguments: [args.cfg.coinType],
    arguments: [
      tx.object(args.sessionObjectId),
      tx.pure.u64(args.amountAtomic),
    ],
  });
  const txBytes = await tx.build({ client });
  return { txBytesB64: Buffer.from(txBytes).toString('base64') };
}

/**
 * S5-T16 — composable bundles.
 *
 * Move entry points (contracts/sources/bundle.move):
 *   mcpx::bundle::create(name, server_ids, price_multiplier_x100,
 *                        metadata_blob_id, clock, ctx) -> ID
 *     `create` shares the Bundle internally and returns its ID. The returned
 *     `ID` has `copy, drop` so the PTB can discard it.
 *   mcpx::bundle::activate_for_user(bundle, clock, ctx)
 *     emits BundleActivated for the sender; takes the shared `&Bundle` + Clock.
 *
 * `server_ids: vector<ID>` — Sui `ID` is BCS-identical to `address`; the
 * builder makes a Move vector of `0x2::object::ID` from the id strings.
 */
export async function buildCreateBundleTx(args: {
  cfg: SuiTxConfig;
  sender: string;
  name: string;
  serverObjectIds: string[];
  /** Multiplier × 100 (e.g. 90 = 0.9× = 10% discount). 1..1000. */
  priceMultiplierX100: number;
  metadataBlobId?: string;
}): Promise<BuiltTx> {
  const { Transaction, SuiClient } = await sui();
  const client = new SuiClient({ url: args.cfg.rpcUrl });
  const tx = new Transaction();
  tx.setSender(args.sender);
  const enc = (s: string) => Array.from(new TextEncoder().encode(s));
  const serverIds = tx.makeMoveVec({
    type: '0x2::object::ID',
    elements: args.serverObjectIds.map((id) => tx.pure.address(id)),
  });
  tx.moveCall({
    target: `${args.cfg.packageId}::bundle::create`,
    arguments: [
      tx.pure.vector('u8', enc(args.name)),
      serverIds,
      tx.pure.u32(args.priceMultiplierX100),
      tx.pure.vector('u8', enc(args.metadataBlobId ?? '')),
      tx.object('0x6'), // Clock
    ],
  });
  const txBytes = await tx.build({ client });
  return { txBytesB64: Buffer.from(txBytes).toString('base64') };
}

export async function buildActivateBundleTx(args: {
  cfg: SuiTxConfig;
  sender: string;
  bundleObjectId: string;
}): Promise<BuiltTx> {
  const { Transaction, SuiClient } = await sui();
  const client = new SuiClient({ url: args.cfg.rpcUrl });
  const tx = new Transaction();
  tx.setSender(args.sender);
  tx.moveCall({
    target: `${args.cfg.packageId}::bundle::activate_for_user`,
    arguments: [
      tx.object(args.bundleObjectId), // shared &Bundle
      tx.object('0x6'), // Clock
    ],
  });
  const txBytes = await tx.build({ client });
  return { txBytesB64: Buffer.from(txBytes).toString('base64') };
}

/**
 * S6-T05 — Spending Intents.
 *
 * Move entry points (contracts/sources/intent.move):
 *   mcpx::intent::create(agent, daily_cap_atomic, per_call_cap_atomic,
 *                        server_ids: vector<ID>, allowed_categories:
 *                        vector<vector<u8>>, expires_at_ms, clock, ctx) -> ID
 *     shares the SpendingIntent internally; the returned `ID` is discardable.
 *   mcpx::intent::revoke(intent: &mut SpendingIntent, clock, ctx)
 *
 * The web builds these PTBs server-side and hands the BCS bytes to Privy's
 * embedded wallet — identical flow to session recharge (S4-T06/T07). The
 * server never holds the key and never writes the `intents` mirror (ADR-011).
 */
export async function buildCreateIntentTx(args: {
  cfg: SuiTxConfig;
  sender: string;
  agentAddress: string;
  dailyCapAtomic: bigint;
  perCallCapAtomic: bigint;
  /** Scoped server object ids. Empty = any server. */
  serverObjectIds: string[];
  /** Allowed category strings. Empty = any category. */
  allowedCategories: string[];
  expiresAtMs: bigint;
}): Promise<BuiltTx> {
  const { Transaction, SuiClient } = await sui();
  const client = new SuiClient({ url: args.cfg.rpcUrl });
  const tx = new Transaction();
  tx.setSender(args.sender);
  const enc = (s: string) => Array.from(new TextEncoder().encode(s));
  const serverIds = tx.makeMoveVec({
    type: '0x2::object::ID',
    elements: args.serverObjectIds.map((id) => tx.pure.address(id)),
  });
  const categories = tx.makeMoveVec({
    type: 'vector<u8>',
    elements: args.allowedCategories.map((c) => tx.pure.vector('u8', enc(c))),
  });
  tx.moveCall({
    target: `${args.cfg.packageId}::intent::create`,
    arguments: [
      tx.pure.address(args.agentAddress),
      tx.pure.u64(args.dailyCapAtomic),
      tx.pure.u64(args.perCallCapAtomic),
      serverIds,
      categories,
      tx.pure.u64(args.expiresAtMs),
      tx.object('0x6'), // Clock
    ],
  });
  const txBytes = await tx.build({ client });
  return { txBytesB64: Buffer.from(txBytes).toString('base64') };
}

export async function buildRevokeIntentTx(args: {
  cfg: SuiTxConfig;
  sender: string;
  intentObjectId: string;
}): Promise<BuiltTx> {
  const { Transaction, SuiClient } = await sui();
  const client = new SuiClient({ url: args.cfg.rpcUrl });
  const tx = new Transaction();
  tx.setSender(args.sender);
  tx.moveCall({
    target: `${args.cfg.packageId}::intent::revoke`,
    arguments: [
      tx.object(args.intentObjectId), // shared &mut SpendingIntent
      tx.object('0x6'), // Clock
    ],
  });
  const txBytes = await tx.build({ client });
  return { txBytesB64: Buffer.from(txBytes).toString('base64') };
}

/** A tool as it goes into `mcpx::registry::add_tool`. */
export interface PublishToolInput {
  name: string;
  description: string;
  inputSchemaBlobId: string;
  priceAtomic: bigint;
  freeTierCallsPerUser: number;
  timeoutSeconds: number;
}

/**
 * Builds the publish PTB used by `@mcpxgg/cli`:
 *   1. `registry::publish_server` → returns a `ServerOwnerCap`
 *   2. `registry::add_tool` once per tool (atomic with the publish)
 *   3. transfers the `ServerOwnerCap` to the sender
 *
 * Move entry points (contracts/sources/registry.move):
 *   mcpx::registry::publish_server(registry, namespace_bytes, endpoint_url,
 *                                  metadata_blob_id, category, clock, ctx) -> ServerOwnerCap
 *   mcpx::registry::add_tool(server, cap, name_bytes, description,
 *                            input_schema_blob_id, price_atomic,
 *                            free_tier_calls_per_user, timeout_seconds, clock)
 *
 * NOTE: `add_tool` takes `&mut Server`, and `publish_server` *shares* the
 * Server object internally, so tools cannot be added in the same PTB as the
 * publish. The CLI therefore publishes first, then issues a follow-up
 * add-tools PTB once the shared Server id is known. This builder assembles
 * only the `publish_server` call (+ cap transfer); see
 * `buildAddToolsTx` for the second step.
 */
export async function buildPublishServerTx(args: {
  cfg: SuiTxConfig;
  /** Shared NamespaceRegistry object id (cfg.sessionRegistryId reused). */
  registryId: string;
  sender: string;
  namespace: string;
  endpointUrl: string;
  metadataBlobId: string;
  category: string;
}): Promise<BuiltTx> {
  const { Transaction, SuiClient } = await sui();
  const client = new SuiClient({ url: args.cfg.rpcUrl });
  const tx = new Transaction();
  tx.setSender(args.sender);
  const enc = (s: string) => Array.from(new TextEncoder().encode(s));
  const cap = tx.moveCall({
    target: `${args.cfg.packageId}::registry::publish_server`,
    arguments: [
      tx.object(args.registryId),
      tx.pure.vector('u8', enc(args.namespace)),
      tx.pure.vector('u8', enc(args.endpointUrl)),
      tx.pure.vector('u8', enc(args.metadataBlobId)),
      tx.pure.vector('u8', enc(args.category)),
      tx.object('0x6'), // Clock
    ],
  });
  tx.transferObjects([cap], tx.pure.address(args.sender));
  const txBytes = await tx.build({ client });
  return { txBytesB64: Buffer.from(txBytes).toString('base64') };
}

/**
 * S6-T18 — quality oracle attestation PTB.
 *
 * Move entry point (contracts/sources/quality.move):
 *   mcpx::quality::attest(&OracleCap, server_id: ID, score_x100: u32,
 *     uptime_x100: u32, p95_latency_ms: u32, error_rate_x100: u32,
 *     sample_count: u64, window_start_ms: u64, window_end_ms: u64,
 *     clock: &Clock, ctx) -> ID
 *
 * `attest` returns an `ID` (copy,drop) the PTB discards. The OracleCap is an
 * owned object held by the oracle's signing address — only that key may
 * attest. Built here so the oracle service never imports @mysten/sui.
 */
export interface AttestQualityArgs {
  cfg: Pick<SuiTxConfig, 'packageId' | 'rpcUrl'>;
  sender: string;
  /** Owned OracleCap object id held by `sender`. */
  oracleCapId: string;
  serverObjectId: string;
  /** Composite quality score ×100 (0..10000). */
  scoreX100: number;
  /** Uptime ×100 (0..10000). */
  uptimeX100: number;
  p95LatencyMs: number;
  /** Error rate ×100 (0..10000). */
  errorRateX100: number;
  sampleCount: number;
  windowStartMs: number;
  windowEndMs: number;
}

export async function buildAttestQualityTx(args: AttestQualityArgs): Promise<BuiltTx> {
  const { Transaction, SuiClient } = await sui();
  const client = new SuiClient({ url: args.cfg.rpcUrl });
  const tx = new Transaction();
  tx.setSender(args.sender);
  tx.moveCall({
    target: `${args.cfg.packageId}::quality::attest`,
    arguments: [
      tx.object(args.oracleCapId),
      tx.pure.address(args.serverObjectId), // ID is BCS-identical to address
      tx.pure.u32(args.scoreX100),
      tx.pure.u32(args.uptimeX100),
      tx.pure.u32(args.p95LatencyMs),
      tx.pure.u32(args.errorRateX100),
      tx.pure.u64(BigInt(args.sampleCount)),
      tx.pure.u64(BigInt(args.windowStartMs)),
      tx.pure.u64(BigInt(args.windowEndMs)),
      tx.object('0x6'), // Clock
    ],
  });
  const txBytes = await tx.build({ client });
  return { txBytesB64: Buffer.from(txBytes).toString('base64') };
}

/**
 * Second-step PTB: adds every tool to an already-published (shared) Server.
 * Atomic across all tools — either every tool lands or none do.
 */
export async function buildAddToolsTx(args: {
  cfg: SuiTxConfig;
  sender: string;
  serverObjectId: string;
  ownerCapId: string;
  tools: PublishToolInput[];
}): Promise<BuiltTx> {
  const { Transaction, SuiClient } = await sui();
  const client = new SuiClient({ url: args.cfg.rpcUrl });
  const tx = new Transaction();
  tx.setSender(args.sender);
  const enc = (s: string) => Array.from(new TextEncoder().encode(s));
  for (const t of args.tools) {
    tx.moveCall({
      target: `${args.cfg.packageId}::registry::add_tool`,
      arguments: [
        tx.object(args.serverObjectId),
        tx.object(args.ownerCapId),
        tx.pure.vector('u8', enc(t.name)),
        tx.pure.vector('u8', enc(t.description)),
        tx.pure.vector('u8', enc(t.inputSchemaBlobId)),
        tx.pure.u64(t.priceAtomic),
        tx.pure.u64(BigInt(t.freeTierCallsPerUser)),
        tx.pure.u32(t.timeoutSeconds),
        tx.object('0x6'), // Clock
      ],
    });
  }
  const txBytes = await tx.build({ client });
  return { txBytesB64: Buffer.from(txBytes).toString('base64') };
}

/**
 * S7 — SLA staking + insurance claim/top-up builders.
 *
 * Move entry points:
 *   mcpx::staking::post<T>(config, server_id: ID, deposit: Coin<T>,
 *       sla_uptime_x100: u32, sla_window_seconds: u64,
 *       lock_duration_ms: u64, clock, ctx) -> ID
 *   mcpx::staking::top_up<T>(stake: &mut ServerStake<T>, deposit: Coin<T>, ctx)
 *   mcpx::staking::withdraw<T>(stake: &mut ServerStake<T>, amount: u64,
 *       clock, ctx)
 *   mcpx::staking::slash<T>(&OracleCap, stake: &mut ServerStake<T>,
 *       pool: &mut InsurancePool<T>, amount: u64, reason: vector<u8>, clock)
 *   mcpx::insurance::top_up<T>(pool: &mut InsurancePool<T>, contribution: Coin<T>)
 *   mcpx::settlement::claim_for_failed_call<T>(receipt: &mut CallReceipt,
 *       pool: &mut InsurancePool<T>, clock, ctx) -> u64
 *
 * Staking SLA tiers map to `sla_uptime_x100`: 95% → 9500, 99% → 9900,
 * 99.9% → 9990. All client/dev-signed except `slash`, which is signed by the
 * quality-oracle's OracleCap holder.
 */

/** SLA tier → uptime ×100 the staking contract stores. */
export const SLA_TIER_UPTIME_X100 = { '95': 9500, '99': 9900, '99.9': 9990 } as const;
export type SlaTier = keyof typeof SLA_TIER_UPTIME_X100;

export async function buildPostStakeTx(args: {
  cfg: SuiTxConfig;
  /** Shared PlatformConfig object id. */
  platformConfigId: string;
  sender: string;
  serverObjectId: string;
  stakeAtomic: bigint;
  slaTier: SlaTier;
  slaWindowSeconds: number;
  lockDurationMs: number;
}): Promise<BuiltTx> {
  const { Transaction, SuiClient } = await sui();
  const client = new SuiClient({ url: args.cfg.rpcUrl });
  const tx = new Transaction();
  tx.setSender(args.sender);
  const coin = await coinInput(
    tx,
    client,
    args.sender,
    args.cfg.coinType,
    args.stakeAtomic,
  );
  tx.moveCall({
    target: `${args.cfg.packageId}::staking::post`,
    typeArguments: [args.cfg.coinType],
    arguments: [
      tx.object(args.platformConfigId),
      tx.pure.address(args.serverObjectId), // ID is BCS-identical to address
      coin,
      tx.pure.u32(SLA_TIER_UPTIME_X100[args.slaTier]),
      tx.pure.u64(BigInt(args.slaWindowSeconds)),
      tx.pure.u64(BigInt(args.lockDurationMs)),
      tx.object('0x6'), // Clock
    ],
  });
  const txBytes = await tx.build({ client });
  return { txBytesB64: Buffer.from(txBytes).toString('base64') };
}

export async function buildTopUpStakeTx(args: {
  cfg: SuiTxConfig;
  sender: string;
  stakeObjectId: string;
  amountAtomic: bigint;
}): Promise<BuiltTx> {
  const { Transaction, SuiClient } = await sui();
  const client = new SuiClient({ url: args.cfg.rpcUrl });
  const tx = new Transaction();
  tx.setSender(args.sender);
  const coin = await coinInput(
    tx,
    client,
    args.sender,
    args.cfg.coinType,
    args.amountAtomic,
  );
  tx.moveCall({
    target: `${args.cfg.packageId}::staking::top_up`,
    typeArguments: [args.cfg.coinType],
    arguments: [tx.object(args.stakeObjectId), coin],
  });
  const txBytes = await tx.build({ client });
  return { txBytesB64: Buffer.from(txBytes).toString('base64') };
}

export async function buildWithdrawStakeTx(args: {
  cfg: SuiTxConfig;
  sender: string;
  stakeObjectId: string;
  amountAtomic: bigint;
}): Promise<BuiltTx> {
  const { Transaction, SuiClient } = await sui();
  const client = new SuiClient({ url: args.cfg.rpcUrl });
  const tx = new Transaction();
  tx.setSender(args.sender);
  tx.moveCall({
    target: `${args.cfg.packageId}::staking::withdraw`,
    typeArguments: [args.cfg.coinType],
    arguments: [
      tx.object(args.stakeObjectId),
      tx.pure.u64(args.amountAtomic),
      tx.object('0x6'), // Clock
    ],
  });
  const txBytes = await tx.build({ client });
  return { txBytesB64: Buffer.from(txBytes).toString('base64') };
}

/**
 * Oracle-signed slash PTB. Built by the quality-oracle service; the OracleCap
 * is an owned object held by the oracle's signing address.
 */
export async function buildSlashStakeTx(args: {
  cfg: SuiTxConfig;
  sender: string;
  /** Owned OracleCap object id held by `sender`. */
  oracleCapId: string;
  stakeObjectId: string;
  insurancePoolId: string;
  /**
   * Shared `QualityAttestation` object id that on-chain proves the breach
   * (same server, uptime below committed SLA, fresh). `staking::slash` aborts
   * without it — an OracleCap alone can no longer slash.
   */
  attestationObjectId: string;
  amountAtomic: bigint;
  reason: string;
}): Promise<BuiltTx> {
  const { Transaction, SuiClient } = await sui();
  const client = new SuiClient({ url: args.cfg.rpcUrl });
  const tx = new Transaction();
  tx.setSender(args.sender);
  const enc = (s: string) => Array.from(new TextEncoder().encode(s));
  tx.moveCall({
    target: `${args.cfg.packageId}::staking::slash`,
    typeArguments: [args.cfg.coinType],
    arguments: [
      tx.object(args.oracleCapId),
      tx.object(args.stakeObjectId),
      tx.object(args.insurancePoolId),
      tx.object(args.attestationObjectId),
      tx.pure.u64(args.amountAtomic),
      tx.pure.vector('u8', enc(args.reason)),
      tx.object('0x6'), // Clock
    ],
  });
  const txBytes = await tx.build({ client });
  return { txBytesB64: Buffer.from(txBytes).toString('base64') };
}

/** Permissionless, user-signed: reclaim a failed call's cost from insurance. */
export async function buildClaimFailedCallTx(args: {
  cfg: SuiTxConfig;
  sender: string;
  /** Soulbound CallReceipt object id owned by `sender` (the payer). */
  receiptObjectId: string;
  insurancePoolId: string;
}): Promise<BuiltTx> {
  const { Transaction, SuiClient } = await sui();
  const client = new SuiClient({ url: args.cfg.rpcUrl });
  const tx = new Transaction();
  tx.setSender(args.sender);
  tx.moveCall({
    target: `${args.cfg.packageId}::settlement::claim_for_failed_call`,
    typeArguments: [args.cfg.coinType],
    arguments: [
      tx.object(args.receiptObjectId),
      tx.object(args.insurancePoolId),
      tx.object('0x6'), // Clock
    ],
  });
  const txBytes = await tx.build({ client });
  return { txBytesB64: Buffer.from(txBytes).toString('base64') };
}

/** Sponsor donation top-up of the insurance pool. */
export async function buildTopUpInsuranceTx(args: {
  cfg: SuiTxConfig;
  sender: string;
  insurancePoolId: string;
  amountAtomic: bigint;
}): Promise<BuiltTx> {
  const { Transaction, SuiClient } = await sui();
  const client = new SuiClient({ url: args.cfg.rpcUrl });
  const tx = new Transaction();
  tx.setSender(args.sender);
  const coin = await coinInput(
    tx,
    client,
    args.sender,
    args.cfg.coinType,
    args.amountAtomic,
  );
  tx.moveCall({
    target: `${args.cfg.packageId}::insurance::top_up`,
    typeArguments: [args.cfg.coinType],
    arguments: [tx.object(args.insurancePoolId), coin],
  });
  const txBytes = await tx.build({ client });
  return { txBytesB64: Buffer.from(txBytes).toString('base64') };
}
