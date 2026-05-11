import type { Handler } from './dispatch.js';
import { asAddress, asBigint, asNumber, asString } from './parse.js';

export const handleSessionCreated: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.createSession({
    sessionObjectId: asString(f.session_id, 'session_id'),
    ownerAddress: asAddress(f.owner, 'owner'),
    initialBalanceAtomic: asBigint(f.initial_balance_atomic, 'initial_balance_atomic'),
    txDigest: event.txDigest,
    timestampMs: asNumber(f.timestamp_ms, 'timestamp_ms'),
  });
};

export const handleSessionDeposit: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.applySessionDeposit({
    sessionObjectId: asString(f.session_id, 'session_id'),
    newBalanceAtomic: asBigint(f.new_balance_atomic, 'new_balance_atomic'),
    amountAtomic: asBigint(f.amount_atomic, 'amount_atomic'),
    txDigest: event.txDigest,
  });
};

export const handleSessionWithdraw: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.applySessionWithdraw({
    sessionObjectId: asString(f.session_id, 'session_id'),
    newBalanceAtomic: asBigint(f.new_balance_atomic, 'new_balance_atomic'),
    amountAtomic: asBigint(f.amount_atomic, 'amount_atomic'),
    txDigest: event.txDigest,
  });
};

export const handleSessionLimitsUpdated: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.setSessionLimits({
    sessionObjectId: asString(f.session_id, 'session_id'),
    perCallCapAtomic: asBigint(f.per_call_cap_atomic, 'per_call_cap_atomic'),
    perDayCapAtomic: asBigint(f.per_day_cap_atomic, 'per_day_cap_atomic'),
  });
};

export const handleSessionClosed: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.closeSession(asString(f.session_id, 'session_id'), event.txDigest);
};
