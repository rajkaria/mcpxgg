import type { Handler } from './dispatch.js';
import { asAddress, asBigint, asBoolean, asNumber, asString, asUtf8 } from './parse.js';

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
    event.txDigest,
  );
};
