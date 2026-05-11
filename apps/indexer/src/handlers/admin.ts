import type { Handler } from './dispatch.js';
import { asBigint, asBoolean, asNumber } from './parse.js';

export const handleConfigUpdated: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.applyPlatformConfig({
    takeRateBps: asNumber(f.take_rate_bps, 'take_rate_bps'),
    insuranceBps: asNumber(f.insurance_bps, 'insurance_bps'),
    subsidyAtomic: asBigint(f.subsidy_atomic, 'subsidy_atomic'),
    txDigest: event.txDigest,
  });
};

export const handleConfigPaused: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.applyPlatformPause({
    paused: asBoolean(f.paused, 'paused'),
    txDigest: event.txDigest,
    timestampMs: asNumber(f.timestamp_ms, 'timestamp_ms'),
  });
};
