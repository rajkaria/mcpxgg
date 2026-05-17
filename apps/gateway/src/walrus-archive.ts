/**
 * Archive the request/response envelope to Walrus (S3-T05). The returned
 * blob id is permanent (ADR: permanent receipts) and is handed to the
 * facilitator so it lands on the on-chain CallReceipt.
 *
 * Archival must never fail the call: if Walrus is unreachable we return null
 * and settle without a blob id (the receipt still exists on-chain, just
 * without the payload pointer). Logged by the caller.
 */

import type { WalrusClient } from '@mcpxgg/walrus';

export interface ArchiveEnvelope {
  v: 1;
  namespace: string;
  toolName: string;
  userId: string;
  requestId: string;
  ts: number;
  request: { arguments: Record<string, unknown> };
  response: { content: unknown; isError: boolean };
  /** Pay-per-output streaming summary (S7-T04). Absent for unary calls. */
  stream?: { chunks: number; metered_atomic: string };
}

export async function archiveCall(
  walrus: WalrusClient,
  env: ArchiveEnvelope,
): Promise<string | null> {
  try {
    const { blobId } = await walrus.uploadJSON(env);
    return blobId;
  } catch {
    return null;
  }
}
