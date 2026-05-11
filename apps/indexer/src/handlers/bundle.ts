import type { Handler } from './dispatch.js';
import { asAddress, asNumber, asString } from './parse.js';

export const handleBundleCreated: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.upsertBundle({
    bundleObjectId: asString(f.bundle_id, 'bundle_id'),
    creatorAddress: asAddress(f.creator, 'creator'),
    serverCount: asNumber(f.server_count, 'server_count'),
    priceMultiplierX100: asNumber(f.price_multiplier_x100, 'price_multiplier_x100'),
    txDigest: event.txDigest,
  });
};

export const handleBundleActivated: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.recordBundleActivation({
    bundleObjectId: asString(f.bundle_id, 'bundle_id'),
    userAddress: asAddress(f.user, 'user'),
    timestampMs: asNumber(f.timestamp_ms, 'timestamp_ms'),
    txDigest: event.txDigest,
  });
};
