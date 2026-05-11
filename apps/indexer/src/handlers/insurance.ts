import type { Handler } from './dispatch.js';
import { asBigint } from './parse.js';

export const handleInsuranceCollected: Handler = async (event, ctx) => {
  const amount = asBigint(event.parsedJson.amount_atomic, 'amount_atomic');
  await ctx.storage.applyPlatformDelta({
    field: 'insurance_balance_atomic',
    amountAtomic: amount,
    txDigest: event.txDigest,
  });
  await ctx.storage.applyPlatformDelta({
    field: 'insurance_lifetime_atomic',
    amountAtomic: amount,
    txDigest: event.txDigest,
  });
};

export const handleInsurancePaid: Handler = async (event, ctx) => {
  const amount = asBigint(event.parsedJson.amount_atomic, 'amount_atomic');
  await ctx.storage.applyPlatformDelta({
    field: 'insurance_balance_atomic',
    amountAtomic: -amount,
    txDigest: event.txDigest,
  });
  await ctx.storage.applyPlatformDelta({
    field: 'insurance_paid_atomic',
    amountAtomic: amount,
    txDigest: event.txDigest,
  });
};
