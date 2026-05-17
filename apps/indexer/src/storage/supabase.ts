/**
 * Supabase-backed Storage. Each write maps to a single UPSERT / UPDATE on
 * the indexer-mirror schema (migrations 006 + 007). Atomic amounts cross
 * to Postgres BIGINT as strings (the supabase-js client serialises bigint
 * to JSON number, which is lossy past 2^53; we stringify ourselves).
 *
 * Lazy-loaded so tests don't require @supabase/supabase-js to resolve.
 */

import type { ChainId } from '@mcpxgg/shared';
import type {
  BundleActivation,
  BundleCreation,
  CheckpointState,
  DedupResult,
  IntentCreate,
  IntentRevoke,
  IntentUsage,
  PlatformConfigUpdate,
  PlatformDelta,
  PlatformPause,
  QualityAttestation,
  RequestLogInsert,
  ReviewRecord,
  ServerDeactivation,
  ServerUpdate,
  ServerUpsert,
  SessionCreate,
  SessionDelta,
  SessionLimits,
  StakeRecord,
  StakeSlash,
  Storage,
  ToolRemoval,
  ToolUpsert,
  VaultClaim,
  VaultUpsert,
} from './storage.js';

export async function createSupabaseStorage(
  supabaseUrl: string,
  serviceRoleKey: string,
  chainId: ChainId = 'sui',
): Promise<Storage> {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const asString = (b: bigint): string => b.toString();

  return {
    chainId,

    async recordEvent(key): Promise<DedupResult> {
      const { error, data } = await sb
        .from('indexer_event_log')
        .insert({ chain_id: chainId, tx_digest: key.txDigest, event_seq: key.eventSeq })
        .select('tx_digest')
        .maybeSingle();
      if (error) {
        // 23505 = unique_violation in PG; treat as duplicate.
        if (error.code === '23505') return { wasDuplicate: true };
        throw new Error(`recordEvent failed: ${error.message}`);
      }
      return { wasDuplicate: !data };
    },

    async upsertServer(u: ServerUpsert): Promise<void> {
      const { error } = await sb.from('mcp_servers').upsert(
        {
          object_id: u.serverObjectId,
          chain_id: chainId,
          owner_address: u.ownerAddress,
          namespace: u.namespace,
          metadata_blob_id: u.metadataBlobId,
          category: u.category,
          tx_digest: u.txDigest,
          published_at: new Date(u.publishedAtMs).toISOString(),
          status: u.active ? 'active' : 'archived',
        },
        { onConflict: 'object_id' },
      );
      if (error) throw new Error(`upsertServer: ${error.message}`);
    },

    async bumpServerVersion(u: ServerUpdate): Promise<void> {
      const { error } = await sb
        .from('mcp_servers')
        .update({ on_chain_version: u.version, tx_digest: u.txDigest })
        .eq('object_id', u.serverObjectId);
      if (error) throw new Error(`bumpServerVersion: ${error.message}`);
    },

    async deactivateServer(u: ServerDeactivation): Promise<void> {
      const { error } = await sb
        .from('mcp_servers')
        .update({ status: 'archived', tx_digest: u.txDigest })
        .eq('object_id', u.serverObjectId);
      if (error) throw new Error(`deactivateServer: ${error.message}`);
    },

    async upsertTool(u: ToolUpsert): Promise<void> {
      const { error } = await sb.from('mcp_tools').upsert(
        {
          server_object_id: u.serverObjectId,
          tool_name: u.toolName,
          price_atomic: asString(u.priceAtomic),
        },
        { onConflict: 'server_object_id,tool_name' },
      );
      if (error) throw new Error(`upsertTool: ${error.message}`);
    },

    async removeTool(u: ToolRemoval): Promise<void> {
      const { error } = await sb
        .from('mcp_tools')
        .update({ is_enabled: false })
        .eq('server_object_id', u.serverObjectId)
        .eq('tool_name', u.toolName);
      if (error) throw new Error(`removeTool: ${error.message}`);
    },

    async createSession(u: SessionCreate): Promise<void> {
      const { error } = await sb.from('chain_balances').upsert(
        {
          session_object_id: u.sessionObjectId,
          chain_id: chainId,
          owner_address: u.ownerAddress,
          balance_atomic: asString(u.initialBalanceAtomic),
          lifetime_deposited_atomic: asString(u.initialBalanceAtomic),
          last_tx_digest: u.txDigest,
          active: true,
        },
        { onConflict: 'session_object_id' },
      );
      if (error) throw new Error(`createSession: ${error.message}`);
    },

    async applySessionDeposit(u: SessionDelta): Promise<void> {
      const { error } = await sb.rpc('apply_session_deposit', {
        p_session: u.sessionObjectId,
        p_new_balance: asString(u.newBalanceAtomic),
        p_amount: asString(u.amountAtomic),
        p_tx: u.txDigest,
      });
      if (error) throw new Error(`applySessionDeposit: ${error.message}`);
    },

    async applySessionWithdraw(u: SessionDelta): Promise<void> {
      const { error } = await sb
        .from('chain_balances')
        .update({ balance_atomic: asString(u.newBalanceAtomic), last_tx_digest: u.txDigest })
        .eq('session_object_id', u.sessionObjectId);
      if (error) throw new Error(`applySessionWithdraw: ${error.message}`);
    },

    async setSessionLimits(u: SessionLimits): Promise<void> {
      const { error } = await sb
        .from('chain_balances')
        .update({
          per_call_cap_atomic: asString(u.perCallCapAtomic),
          per_day_cap_atomic: asString(u.perDayCapAtomic),
        })
        .eq('session_object_id', u.sessionObjectId);
      if (error) throw new Error(`setSessionLimits: ${error.message}`);
    },

    async closeSession(sessionObjectId, txDigest): Promise<void> {
      const { error } = await sb
        .from('chain_balances')
        .update({ active: false, last_tx_digest: txDigest })
        .eq('session_object_id', sessionObjectId);
      if (error) throw new Error(`closeSession: ${error.message}`);
    },

    async insertRequestLog(u: RequestLogInsert): Promise<void> {
      const { error } = await sb.from('request_log').insert({
        chain_id: chainId,
        receipt_object_id: u.receiptObjectId,
        tx_digest: u.txDigest,
        server_object_id: u.serverObjectId,
        owner_address: u.payerAddress,
        tool_name: u.toolName,
        amount_atomic: asString(u.amountAtomic),
        dev_share_atomic: asString(u.devShareAtomic),
        treasury_share_atomic: asString(u.treasuryShareAtomic),
        insurance_share_atomic: asString(u.insuranceShareAtomic),
        receipt_blob_id: u.receiptBlobId,
        status: u.success ? 'success' : 'error',
        created_at: new Date(u.timestampMs).toISOString(),
      });
      if (error) throw new Error(`insertRequestLog: ${error.message}`);
    },

    async markRequestRefunded(receiptObjectId, refundAmountAtomic, txDigest): Promise<void> {
      const { error } = await sb
        .from('request_log')
        .update({
          status: 'refunded',
          response_meta: { refund_amount_atomic: asString(refundAmountAtomic), refund_tx_digest: txDigest },
        })
        .eq('receipt_object_id', receiptObjectId);
      if (error) throw new Error(`markRequestRefunded: ${error.message}`);
    },

    async upsertVault(u: VaultUpsert): Promise<void> {
      const { error } = await sb.from('developer_vaults').upsert(
        {
          vault_object_id: u.vaultObjectId,
          chain_id: chainId,
          owner_address: u.ownerAddress,
          accrued_balance_atomic: asString(u.accruedBalanceAtomic),
          lifetime_earnings_atomic: asString(u.lifetimeEarningsAtomic),
          last_tx_digest: u.txDigest,
        },
        { onConflict: 'vault_object_id' },
      );
      if (error) throw new Error(`upsertVault: ${error.message}`);
    },

    async applyVaultClaim(u: VaultClaim): Promise<void> {
      const { error } = await sb.rpc('apply_vault_claim', {
        p_vault: u.vaultObjectId,
        p_amount: asString(u.amountAtomic),
        p_tx: u.txDigest,
      });
      if (error) throw new Error(`applyVaultClaim: ${error.message}`);
    },

    async applyPlatformDelta(u: PlatformDelta): Promise<void> {
      const { error } = await sb.rpc('apply_platform_delta', {
        p_field: u.field,
        p_amount: asString(u.amountAtomic),
        p_tx: u.txDigest,
      });
      if (error) throw new Error(`applyPlatformDelta: ${error.message}`);
    },

    async applyPlatformConfig(u: PlatformConfigUpdate): Promise<void> {
      const { error } = await sb
        .from('platform_state')
        .update({
          take_rate_bps: u.takeRateBps,
          insurance_bps: u.insuranceBps,
          subsidy_atomic: asString(u.subsidyAtomic),
          last_tx_digest: u.txDigest,
        })
        .eq('chain_id', chainId);
      if (error) throw new Error(`applyPlatformConfig: ${error.message}`);
    },

    async applyPlatformPause(u: PlatformPause): Promise<void> {
      const { error } = await sb
        .from('platform_state')
        .update({ paused: u.paused, last_tx_digest: u.txDigest })
        .eq('chain_id', chainId);
      if (error) throw new Error(`applyPlatformPause: ${error.message}`);
    },

    async upsertQuality(u: QualityAttestation): Promise<void> {
      const { error } = await sb.from('quality_attestations').upsert(
        {
          attestation_object_id: u.attestationObjectId,
          server_object_id: u.serverObjectId,
          score_x100: u.scoreX100,
          uptime_x100: u.uptimeX100,
          p95_latency_ms: u.p95LatencyMs,
          error_rate_x100: u.errorRateX100,
          sample_count: u.sampleCount,
          observed_at: new Date(u.timestampMs).toISOString(),
          tx_digest: u.txDigest,
        },
        { onConflict: 'attestation_object_id' },
      );
      if (error) throw new Error(`upsertQuality: ${error.message}`);
    },

    async upsertIntent(u: IntentCreate): Promise<void> {
      const { error } = await sb.from('intents').upsert(
        {
          intent_object_id: u.intentObjectId,
          user_address: u.userAddress,
          agent_address: u.agentAddress,
          daily_cap_atomic: asString(u.dailyCapAtomic),
          expires_at_ms: u.expiresAtMs,
          tx_digest: u.txDigest,
          status: 'active',
        },
        { onConflict: 'intent_object_id' },
      );
      if (error) throw new Error(`upsertIntent: ${error.message}`);
    },

    async revokeIntent(u: IntentRevoke): Promise<void> {
      const { error } = await sb
        .from('intents')
        .update({ status: 'revoked', tx_digest: u.txDigest })
        .eq('intent_object_id', u.intentObjectId);
      if (error) throw new Error(`revokeIntent: ${error.message}`);
    },

    async recordIntentUsage(u: IntentUsage): Promise<void> {
      const { error } = await sb.from('intent_usages').insert({
        intent_object_id: u.intentObjectId,
        receipt_object_id: u.receiptObjectId,
        amount_atomic: asString(u.amountAtomic),
        tx_digest: u.txDigest,
      });
      if (error) throw new Error(`recordIntentUsage: ${error.message}`);
    },

    async upsertStake(u: StakeRecord): Promise<void> {
      const { error } = await sb.from('stakes').upsert(
        {
          stake_object_id: u.stakeObjectId,
          server_object_id: u.serverObjectId,
          owner_address: u.ownerAddress,
          amount_atomic: asString(u.amountAtomic),
          sla_uptime_x100: u.slaUptimeX100,
          tx_digest: u.txDigest,
        },
        { onConflict: 'stake_object_id' },
      );
      if (error) throw new Error(`upsertStake: ${error.message}`);
    },

    async recordStakeSlash(u: StakeSlash): Promise<void> {
      const { error } = await sb.from('stake_slashes').insert({
        stake_object_id: u.stakeObjectId,
        server_object_id: u.serverObjectId,
        amount_atomic: asString(u.amountAtomic),
        reason: u.reason,
        slashed_at: new Date(u.timestampMs).toISOString(),
        tx_digest: u.txDigest,
      });
      if (error) throw new Error(`recordStakeSlash: ${error.message}`);
    },

    async upsertBundle(u: BundleCreation): Promise<void> {
      const { error } = await sb.from('bundles').upsert(
        {
          bundle_object_id: u.bundleObjectId,
          creator_address: u.creatorAddress,
          server_count: u.serverCount,
          price_multiplier_x100: u.priceMultiplierX100,
          tx_digest: u.txDigest,
        },
        { onConflict: 'bundle_object_id' },
      );
      if (error) throw new Error(`upsertBundle: ${error.message}`);
    },

    async recordBundleActivation(u: BundleActivation): Promise<void> {
      // Idempotent on the indexer's natural key (migration 009 adds
      // uq_bundle_activations_event) so an event replay is a no-op upsert
      // rather than a duplicate row.
      const { error } = await sb.from('bundle_activations').upsert(
        {
          bundle_object_id: u.bundleObjectId,
          user_address: u.userAddress,
          activated_at: new Date(u.timestampMs).toISOString(),
          tx_digest: u.txDigest,
        },
        { onConflict: 'bundle_object_id,user_address,tx_digest' },
      );
      if (error) throw new Error(`recordBundleActivation: ${error.message}`);
    },

    async insertReview(u: ReviewRecord): Promise<void> {
      const { error } = await sb.from('reviews_onchain').upsert(
        {
          review_object_id: u.reviewObjectId,
          server_object_id: u.serverObjectId,
          reviewer_address: u.reviewerAddress,
          rating_x10: u.ratingX10,
          tx_digest: u.txDigest,
        },
        { onConflict: 'review_object_id' },
      );
      if (error) throw new Error(`insertReview: ${error.message}`);
    },

    async getCheckpoint(): Promise<CheckpointState> {
      const { data, error } = await sb
        .from('indexer_checkpoints')
        .select('last_processed_checkpoint,last_processed_event_seq,last_tx_digest')
        .eq('chain_id', chainId)
        .maybeSingle();
      if (error) throw new Error(`getCheckpoint: ${error.message}`);
      return {
        lastProcessedCheckpoint: Number(data?.last_processed_checkpoint ?? 0),
        lastProcessedEventSeq: Number(data?.last_processed_event_seq ?? 0),
        lastTxDigest: (data?.last_tx_digest as string | null | undefined) ?? null,
      };
    },

    async updateCheckpoint(state: CheckpointState): Promise<void> {
      const { error } = await sb.from('indexer_checkpoints').upsert(
        {
          chain_id: chainId,
          last_processed_checkpoint: state.lastProcessedCheckpoint,
          last_processed_event_seq: state.lastProcessedEventSeq,
          last_tx_digest: state.lastTxDigest,
          last_processed_at: new Date().toISOString(),
        },
        { onConflict: 'chain_id' },
      );
      if (error) throw new Error(`updateCheckpoint: ${error.message}`);
    },
  };
}
