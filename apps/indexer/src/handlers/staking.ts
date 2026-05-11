import type { Handler } from './dispatch.js';
import { asAddress, asBigint, asNumber, asString, asUtf8 } from './parse.js';

export const handleStakePosted: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.upsertStake({
    stakeObjectId: asString(f.stake_id, 'stake_id'),
    serverObjectId: asString(f.server_id, 'server_id'),
    ownerAddress: asAddress(f.owner, 'owner'),
    amountAtomic: asBigint(f.amount_atomic, 'amount_atomic'),
    slaUptimeX100: asNumber(f.sla_uptime_x100, 'sla_uptime_x100'),
    txDigest: event.txDigest,
  });
};

export const handleStakeSlashed: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.recordStakeSlash({
    stakeObjectId: asString(f.stake_id, 'stake_id'),
    serverObjectId: asString(f.server_id, 'server_id'),
    amountAtomic: asBigint(f.amount_atomic, 'amount_atomic'),
    reason: asUtf8(f.reason, 'reason'),
    timestampMs: asNumber(f.timestamp_ms, 'timestamp_ms'),
    txDigest: event.txDigest,
  });
};
