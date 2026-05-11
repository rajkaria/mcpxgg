import type { Handler } from './dispatch.js';
import { asAddress, asBigint, asNumber, asString } from './parse.js';

export const handleVaultCreated: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.upsertVault({
    vaultObjectId: asString(f.vault_id, 'vault_id'),
    ownerAddress: asAddress(f.owner, 'owner'),
    accruedBalanceAtomic: 0n,
    lifetimeEarningsAtomic: 0n,
    txDigest: event.txDigest,
  });
};

export const handleVaultAccrued: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.upsertVault({
    vaultObjectId: asString(f.vault_id, 'vault_id'),
    ownerAddress: '0x0', // unknown at this event; existing row keeps its owner
    accruedBalanceAtomic: asBigint(f.new_balance_atomic, 'new_balance_atomic'),
    lifetimeEarningsAtomic: asBigint(f.lifetime_earnings_atomic, 'lifetime_earnings_atomic'),
    txDigest: event.txDigest,
  });
};

export const handleVaultClaimed: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.applyVaultClaim({
    vaultObjectId: asString(f.vault_id, 'vault_id'),
    ownerAddress: asAddress(f.owner, 'owner'),
    amountAtomic: asBigint(f.amount_atomic, 'amount_atomic'),
    txDigest: event.txDigest,
    timestampMs: asNumber(f.timestamp_ms, 'timestamp_ms'),
  });
};
