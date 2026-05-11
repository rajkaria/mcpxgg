import type { Handler } from './dispatch.js';
import { asAddress, asBigint, asNumber, asString } from './parse.js';

export const handleIntentCreated: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.upsertIntent({
    intentObjectId: asString(f.intent_id, 'intent_id'),
    userAddress: asAddress(f.user, 'user'),
    agentAddress: asAddress(f.agent, 'agent'),
    dailyCapAtomic: asBigint(f.daily_cap_atomic, 'daily_cap_atomic'),
    expiresAtMs: asNumber(f.expires_at_ms, 'expires_at_ms'),
    txDigest: event.txDigest,
  });
};

export const handleIntentRevoked: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.revokeIntent({
    intentObjectId: asString(f.intent_id, 'intent_id'),
    timestampMs: asNumber(f.timestamp_ms, 'timestamp_ms'),
    txDigest: event.txDigest,
  });
};

export const handleIntentUsed: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.recordIntentUsage({
    intentObjectId: asString(f.intent_id, 'intent_id'),
    receiptObjectId: asString(f.receipt_id, 'receipt_id'),
    amountAtomic: asBigint(f.amount_atomic, 'amount_atomic'),
    txDigest: event.txDigest,
  });
};
