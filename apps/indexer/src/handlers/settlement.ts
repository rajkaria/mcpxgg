import type { Handler } from './dispatch.js';
import { asAddress, asBigint, asBoolean, asNumber, asString, asUtf8 } from './parse.js';

const asOptNumber = (v: unknown): number => (v == null ? 0 : asNumber(v, 'timestamp_ms'));

export const handleCallSettled: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.insertRequestLog({
    receiptObjectId: asString(f.receipt_id, 'receipt_id'),
    serverObjectId: asString(f.server_id, 'server_id'),
    payerAddress: asAddress(f.payer, 'payer'),
    toolName: asUtf8(f.tool_name, 'tool_name'),
    amountAtomic: asBigint(f.amount_atomic, 'amount_atomic'),
    devShareAtomic: asBigint(f.dev_share_atomic, 'dev_share_atomic'),
    treasuryShareAtomic: asBigint(f.treasury_share_atomic, 'treasury_share_atomic'),
    insuranceShareAtomic: asBigint(f.insurance_share_atomic, 'insurance_share_atomic'),
    receiptBlobId: asUtf8(f.log_blob_id, 'log_blob_id'),
    success: asBoolean(f.success, 'success'),
    timestampMs: asNumber(f.timestamp_ms, 'timestamp_ms'),
    txDigest: event.txDigest,
  });
};

export const handleRefundIssued: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.markRequestRefunded(
    asString(f.original_receipt_id, 'original_receipt_id'),
    asBigint(f.refund_amount_atomic, 'refund_amount_atomic'),
    asOptNumber(f.timestamp_ms),
    event.txDigest,
  );
};

export const handleUptoFinalized: Handler = async (event, ctx) => {
  const f = event.parsedJson;
  await ctx.storage.finalizeUpto({
    receiptObjectId: asString(f.receipt_id, 'receipt_id'),
    quotedMaxAtomic: asBigint(f.quoted_max_atomic, 'quoted_max_atomic'),
    actualAtomic: asBigint(f.actual_atomic, 'actual_atomic'),
    unusedAtomic: asBigint(f.unused_atomic, 'unused_atomic'),
    txDigest: event.txDigest,
  });
};
