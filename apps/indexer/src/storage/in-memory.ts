/**
 * In-memory Storage for tests. Captures every write so handler tests can
 * assert against `storage.servers.get('0xabc')` etc.
 */

import type { ChainId } from '@mcpxgg/shared';
import type {
  AbuseFlagInsert,
  AccountAggregate,
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
  UptoFinalization,
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

interface ServerRow extends ServerUpsert {
  version: number;
}

interface SessionRow {
  sessionObjectId: string;
  ownerAddress: string;
  balanceAtomic: bigint;
  perCallCapAtomic: bigint;
  perDayCapAtomic: bigint;
  lifetimeDepositedAtomic: bigint;
  lifetimeSpentAtomic: bigint;
  active: boolean;
  lastTxDigest: string;
}

interface VaultRow {
  vaultObjectId: string;
  ownerAddress: string;
  accruedBalanceAtomic: bigint;
  lifetimeEarningsAtomic: bigint;
  lifetimeClaimedAtomic: bigint;
  lastTxDigest: string;
}

export interface InMemoryState {
  servers: Map<string, ServerRow>;
  tools: Map<string, ToolUpsert>;
  sessions: Map<string, SessionRow>;
  requestLog: RequestLogInsert[];
  refunds: { receiptObjectId: string; amountAtomic: bigint; timestampMs: number; txDigest: string }[];
  uptoFinalizations: UptoFinalization[];
  vaults: Map<string, VaultRow>;
  vaultClaims: VaultClaim[];
  platform: {
    treasury_balance_atomic: bigint;
    insurance_balance_atomic: bigint;
    treasury_lifetime_atomic: bigint;
    insurance_lifetime_atomic: bigint;
    insurance_paid_atomic: bigint;
    takeRateBps: number;
    insuranceBps: number;
    subsidyAtomic: bigint;
    paused: boolean;
  };
  qualities: QualityAttestation[];
  intents: Map<string, IntentCreate & { revoked: boolean; usages: IntentUsage[] }>;
  stakes: Map<string, StakeRecord & { slashes: StakeSlash[] }>;
  bundles: Map<string, BundleCreation & { activations: BundleActivation[] }>;
  reviews: ReviewRecord[];
  abuseFlags: AbuseFlagInsert[];
  seenEvents: Set<string>;
  checkpoint: CheckpointState;
}

export function createInMemoryStorage(chainId: ChainId = 'sui'): Storage & { state: InMemoryState } {
  const state: InMemoryState = {
    servers: new Map(),
    tools: new Map(),
    sessions: new Map(),
    requestLog: [],
    refunds: [],
    uptoFinalizations: [],
    vaults: new Map(),
    vaultClaims: [],
    platform: {
      treasury_balance_atomic: 0n,
      insurance_balance_atomic: 0n,
      treasury_lifetime_atomic: 0n,
      insurance_lifetime_atomic: 0n,
      insurance_paid_atomic: 0n,
      takeRateBps: 250,
      insuranceBps: 50,
      subsidyAtomic: 0n,
      paused: false,
    },
    qualities: [],
    intents: new Map(),
    stakes: new Map(),
    bundles: new Map(),
    reviews: [],
    abuseFlags: [],
    seenEvents: new Set(),
    checkpoint: { lastProcessedCheckpoint: 0, lastProcessedEventSeq: 0, lastTxDigest: null },
  };

  const toolKey = (s: string, t: string) => `${s}::${t}`;

  return {
    state,
    chainId,

    async recordEvent({ txDigest, eventSeq }): Promise<DedupResult> {
      const key = `${txDigest}|${eventSeq}`;
      if (state.seenEvents.has(key)) return { wasDuplicate: true };
      state.seenEvents.add(key);
      return { wasDuplicate: false };
    },

    async upsertServer(u: ServerUpsert): Promise<void> {
      const existing = state.servers.get(u.serverObjectId);
      state.servers.set(u.serverObjectId, { ...u, version: existing?.version ?? 1 });
    },

    async bumpServerVersion(u: ServerUpdate): Promise<void> {
      const cur = state.servers.get(u.serverObjectId);
      if (!cur) return;
      state.servers.set(u.serverObjectId, { ...cur, version: u.version });
    },

    async deactivateServer(u: ServerDeactivation): Promise<void> {
      const cur = state.servers.get(u.serverObjectId);
      if (!cur) return;
      state.servers.set(u.serverObjectId, { ...cur, active: false });
    },

    async upsertTool(u: ToolUpsert): Promise<void> {
      state.tools.set(toolKey(u.serverObjectId, u.toolName), u);
    },

    async removeTool(u: ToolRemoval): Promise<void> {
      state.tools.delete(toolKey(u.serverObjectId, u.toolName));
    },

    async createSession(u: SessionCreate): Promise<void> {
      state.sessions.set(u.sessionObjectId, {
        sessionObjectId: u.sessionObjectId,
        ownerAddress: u.ownerAddress,
        balanceAtomic: u.initialBalanceAtomic,
        perCallCapAtomic: 0n,
        perDayCapAtomic: 0n,
        lifetimeDepositedAtomic: u.initialBalanceAtomic,
        lifetimeSpentAtomic: 0n,
        active: true,
        lastTxDigest: u.txDigest,
      });
    },

    async applySessionDeposit(u: SessionDelta): Promise<void> {
      const s = state.sessions.get(u.sessionObjectId);
      if (!s) return;
      state.sessions.set(u.sessionObjectId, {
        ...s,
        balanceAtomic: u.newBalanceAtomic,
        lifetimeDepositedAtomic: s.lifetimeDepositedAtomic + u.amountAtomic,
        lastTxDigest: u.txDigest,
      });
    },

    async applySessionWithdraw(u: SessionDelta): Promise<void> {
      const s = state.sessions.get(u.sessionObjectId);
      if (!s) return;
      state.sessions.set(u.sessionObjectId, {
        ...s,
        balanceAtomic: u.newBalanceAtomic,
        lastTxDigest: u.txDigest,
      });
    },

    async setSessionLimits(u: SessionLimits): Promise<void> {
      const s = state.sessions.get(u.sessionObjectId);
      if (!s) return;
      state.sessions.set(u.sessionObjectId, {
        ...s,
        perCallCapAtomic: u.perCallCapAtomic,
        perDayCapAtomic: u.perDayCapAtomic,
      });
    },

    async closeSession(sessionObjectId: string, txDigest: string): Promise<void> {
      const s = state.sessions.get(sessionObjectId);
      if (!s) return;
      state.sessions.set(sessionObjectId, { ...s, active: false, lastTxDigest: txDigest });
    },

    async insertRequestLog(u: RequestLogInsert): Promise<void> {
      state.requestLog.push(u);
      // Mirror Move debit: subtract from session lifetime spent / balance.
      const sess = [...state.sessions.values()].find((s) =>
        state.requestLog.some((r) => r.payerAddress === s.ownerAddress),
      );
      if (sess) {
        state.sessions.set(sess.sessionObjectId, {
          ...sess,
          lifetimeSpentAtomic: sess.lifetimeSpentAtomic + u.amountAtomic,
        });
      }
    },

    async markRequestRefunded(receiptObjectId, amountAtomic, timestampMs, txDigest): Promise<void> {
      state.refunds.push({ receiptObjectId, amountAtomic, timestampMs, txDigest });
    },

    async finalizeUpto(u: UptoFinalization): Promise<void> {
      state.uptoFinalizations.push(u);
    },

    async upsertVault(u: VaultUpsert): Promise<void> {
      const cur = state.vaults.get(u.vaultObjectId);
      state.vaults.set(u.vaultObjectId, {
        vaultObjectId: u.vaultObjectId,
        ownerAddress: u.ownerAddress,
        accruedBalanceAtomic: u.accruedBalanceAtomic,
        lifetimeEarningsAtomic: u.lifetimeEarningsAtomic,
        lifetimeClaimedAtomic: cur?.lifetimeClaimedAtomic ?? 0n,
        lastTxDigest: u.txDigest,
      });
    },

    async applyVaultClaim(u: VaultClaim): Promise<void> {
      state.vaultClaims.push(u);
      const cur = state.vaults.get(u.vaultObjectId);
      if (cur) {
        state.vaults.set(u.vaultObjectId, {
          ...cur,
          accruedBalanceAtomic:
            cur.accruedBalanceAtomic > u.amountAtomic ? cur.accruedBalanceAtomic - u.amountAtomic : 0n,
          lifetimeClaimedAtomic: cur.lifetimeClaimedAtomic + u.amountAtomic,
          lastTxDigest: u.txDigest,
        });
      }
    },

    async applyPlatformDelta(u: PlatformDelta): Promise<void> {
      state.platform[u.field] = state.platform[u.field] + u.amountAtomic;
    },

    async applyPlatformConfig(u: PlatformConfigUpdate): Promise<void> {
      state.platform.takeRateBps = u.takeRateBps;
      state.platform.insuranceBps = u.insuranceBps;
      state.platform.subsidyAtomic = u.subsidyAtomic;
    },

    async applyPlatformPause(u: PlatformPause): Promise<void> {
      state.platform.paused = u.paused;
    },

    async upsertQuality(u: QualityAttestation): Promise<void> {
      state.qualities.push(u);
    },

    async upsertIntent(u: IntentCreate): Promise<void> {
      state.intents.set(u.intentObjectId, { ...u, revoked: false, usages: [] });
    },

    async revokeIntent(u: IntentRevoke): Promise<void> {
      const cur = state.intents.get(u.intentObjectId);
      if (cur) state.intents.set(u.intentObjectId, { ...cur, revoked: true });
    },

    async recordIntentUsage(u: IntentUsage): Promise<void> {
      const cur = state.intents.get(u.intentObjectId);
      if (cur) cur.usages.push(u);
    },

    async upsertStake(u: StakeRecord): Promise<void> {
      state.stakes.set(u.stakeObjectId, { ...u, slashes: [] });
    },

    async recordStakeSlash(u: StakeSlash): Promise<void> {
      const cur = state.stakes.get(u.stakeObjectId);
      if (cur) cur.slashes.push(u);
    },

    async upsertBundle(u: BundleCreation): Promise<void> {
      state.bundles.set(u.bundleObjectId, { ...u, activations: [] });
    },

    async recordBundleActivation(u: BundleActivation): Promise<void> {
      const cur = state.bundles.get(u.bundleObjectId);
      if (cur) cur.activations.push(u);
    },

    async insertReview(u: ReviewRecord): Promise<void> {
      state.reviews.push(u);
    },

    async getAccountAggregates(
      windowStartMs: number,
      windowEndMs: number,
    ): Promise<AccountAggregate[]> {
      const byAccount = new Map<string, { callVolume: number; spendAtomic: bigint }>();
      for (const r of state.requestLog) {
        if (r.timestampMs < windowStartMs || r.timestampMs >= windowEndMs) continue;
        const cur = byAccount.get(r.payerAddress) ?? { callVolume: 0, spendAtomic: 0n };
        cur.callVolume += 1;
        cur.spendAtomic += r.amountAtomic;
        byAccount.set(r.payerAddress, cur);
      }
      return [...byAccount.entries()].map(([accountAddress, v]) => ({
        accountAddress,
        callVolume: v.callVolume,
        spendAtomic: v.spendAtomic,
      }));
    },

    async insertAbuseFlag(u: AbuseFlagInsert): Promise<void> {
      state.abuseFlags.push(u);
    },

    async getCheckpoint(): Promise<CheckpointState> {
      return { ...state.checkpoint };
    },

    async updateCheckpoint(s: CheckpointState): Promise<void> {
      state.checkpoint = { ...s };
    },
  };
}
