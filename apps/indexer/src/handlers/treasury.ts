import type { Handler } from './dispatch.js';
import { asBigint } from './parse.js';

export const handleTreasuryCollected: Handler = async (event, ctx) => {
  await ctx.storage.applyPlatformDelta({
    field: 'treasury_balance_atomic',
    amountAtomic: asBigint(event.parsedJson.amount_atomic, 'amount_atomic'),
    txDigest: event.txDigest,
  });
  await ctx.storage.applyPlatformDelta({
    field: 'treasury_lifetime_atomic',
    amountAtomic: asBigint(event.parsedJson.amount_atomic, 'amount_atomic'),
    txDigest: event.txDigest,
  });
};

export const handleTreasuryWithdrawn: Handler = async (event, ctx) => {
  await ctx.storage.applyPlatformDelta({
    field: 'treasury_balance_atomic',
    amountAtomic: -asBigint(event.parsedJson.amount_atomic, 'amount_atomic'),
    txDigest: event.txDigest,
  });
};
