import type { Handler } from './dispatch.js';
import { asAddress, asBigint, asNumber, asString, asUtf8 } from './parse.js';

export const handleServerPublished: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.upsertServer({
    serverObjectId: asString(f.server_id, 'server_id'),
    ownerAddress: asAddress(f.owner, 'owner'),
    namespace: asUtf8(f.namespace, 'namespace'),
    metadataBlobId: asUtf8(f.metadata_blob_id, 'metadata_blob_id'),
    category: asUtf8(f.category, 'category'),
    txDigest: event.txDigest,
    publishedAtMs: asNumber(f.timestamp_ms, 'timestamp_ms'),
    active: true,
  });
};

export const handleServerUpdated: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.bumpServerVersion({
    serverObjectId: asString(f.server_id, 'server_id'),
    version: asNumber(f.version, 'version'),
    txDigest: event.txDigest,
    timestampMs: asNumber(f.timestamp_ms, 'timestamp_ms'),
  });
};

export const handleServerDeactivated: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.deactivateServer({
    serverObjectId: asString(f.server_id, 'server_id'),
    txDigest: event.txDigest,
    timestampMs: asNumber(f.timestamp_ms, 'timestamp_ms'),
  });
};

export const handleToolAdded: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.upsertTool({
    serverObjectId: asString(f.server_id, 'server_id'),
    toolName: asUtf8(f.tool_name, 'tool_name'),
    priceAtomic: asBigint(f.price_atomic, 'price_atomic'),
  });
};

export const handleToolRemoved: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.removeTool({
    serverObjectId: asString(f.server_id, 'server_id'),
    toolName: asUtf8(f.tool_name, 'tool_name'),
  });
};
