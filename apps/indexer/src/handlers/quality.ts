import type { Handler } from './dispatch.js';
import { asNumber, asString } from './parse.js';

export const handleQualityAttested: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.upsertQuality({
    attestationObjectId: asString(f.attestation_id, 'attestation_id'),
    serverObjectId: asString(f.server_id, 'server_id'),
    scoreX100: asNumber(f.score_x100, 'score_x100'),
    uptimeX100: asNumber(f.uptime_x100, 'uptime_x100'),
    p95LatencyMs: asNumber(f.p95_latency_ms, 'p95_latency_ms'),
    errorRateX100: asNumber(f.error_rate_x100, 'error_rate_x100'),
    sampleCount: asNumber(f.sample_count, 'sample_count'),
    timestampMs: asNumber(f.timestamp_ms, 'timestamp_ms'),
    txDigest: event.txDigest,
  });
};
