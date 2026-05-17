/**
 * Single dispatch table mapping each Move event type to its handler. Every
 * event in `mcpx::events` MUST be listed here — the runner errors loudly
 * when it sees a type it doesn't recognise. That guarantees no quiet drops.
 */

import type { Storage } from '../storage/storage.js';
import type { Pubsub, PubsubPayload } from '../pubsub/pubsub.js';
import type { EventType, IndexedEvent } from '../types.js';
import {
  handleServerPublished,
  handleServerUpdated,
  handleServerDeactivated,
  handleToolAdded,
  handleToolRemoved,
} from './registry.js';
import {
  handleSessionCreated,
  handleSessionDeposit,
  handleSessionWithdraw,
  handleSessionLimitsUpdated,
  handleSessionClosed,
} from './session.js';
import { handleCallSettled, handleRefundIssued, handleUptoFinalized } from './settlement.js';
import { handleVaultCreated, handleVaultAccrued, handleVaultClaimed } from './vault.js';
import { handleTreasuryCollected, handleTreasuryWithdrawn } from './treasury.js';
import { handleInsuranceCollected, handleInsurancePaid } from './insurance.js';
import { handleConfigUpdated, handleConfigPaused } from './admin.js';
import { handleQualityAttested } from './quality.js';
import { handleIntentCreated, handleIntentRevoked, handleIntentUsed } from './intent.js';
import { handleStakePosted, handleStakeSlashed } from './staking.js';
import { handleBundleCreated, handleBundleActivated } from './bundle.js';
import { handleReviewPosted } from './review.js';

export interface HandlerCtx {
  storage: Storage;
  pubsub: Pubsub;
}

export type Handler = (event: IndexedEvent, ctx: HandlerCtx) => Promise<void>;

/** Channels that get published to pubsub for `/live`. */
const LIVE_PUBSUB_CHANNEL = 'mcpx:live';
const LIVE_EVENT_TYPES = new Set<EventType>([
  'CallSettled',
  'ServerPublished',
  'VaultClaimed',
  'InsurancePaid',
  'BundleActivated',
]);

const TABLE: Record<EventType, Handler> = {
  ServerPublished: handleServerPublished,
  ServerUpdated: handleServerUpdated,
  ServerDeactivated: handleServerDeactivated,
  ToolAdded: handleToolAdded,
  ToolRemoved: handleToolRemoved,
  SessionCreated: handleSessionCreated,
  SessionDeposit: handleSessionDeposit,
  SessionWithdraw: handleSessionWithdraw,
  SessionLimitsUpdated: handleSessionLimitsUpdated,
  SessionClosed: handleSessionClosed,
  CallSettled: handleCallSettled,
  RefundIssued: handleRefundIssued,
  UptoFinalized: handleUptoFinalized,
  VaultCreated: handleVaultCreated,
  VaultAccrued: handleVaultAccrued,
  VaultClaimed: handleVaultClaimed,
  TreasuryCollected: handleTreasuryCollected,
  TreasuryWithdrawn: handleTreasuryWithdrawn,
  InsuranceCollected: handleInsuranceCollected,
  InsurancePaid: handleInsurancePaid,
  ConfigUpdated: handleConfigUpdated,
  ConfigPaused: handleConfigPaused,
  QualityAttested: handleQualityAttested,
  IntentCreated: handleIntentCreated,
  IntentRevoked: handleIntentRevoked,
  IntentUsed: handleIntentUsed,
  StakePosted: handleStakePosted,
  StakeSlashed: handleStakeSlashed,
  BundleCreated: handleBundleCreated,
  BundleActivated: handleBundleActivated,
  ReviewPosted: handleReviewPosted,
};

export async function dispatch(event: IndexedEvent, ctx: HandlerCtx): Promise<void> {
  const dedup = await ctx.storage.recordEvent({ txDigest: event.txDigest, eventSeq: event.eventSeq });
  if (dedup.wasDuplicate) return;

  const handler = TABLE[event.eventType];
  if (!handler) {
    // The compiler already excludes this branch via EventType — keep a runtime
    // guard for forward compat (a future contract upgrade adds a new event
    // before the indexer is redeployed).
    throw new Error(`no handler for event type ${event.eventType}`);
  }
  await handler(event, ctx);

  if (LIVE_EVENT_TYPES.has(event.eventType)) {
    const payload: PubsubPayload = {
      eventType: event.eventType,
      txDigest: event.txDigest,
      timestampMs: event.timestampMs,
      data: event.parsedJson,
    };
    await ctx.pubsub.publish(LIVE_PUBSUB_CHANNEL, payload);
  }
}
