/**
 * `_meta.receipt` injection (S3-T06). Every successful tool response carries
 * a verifiable receipt and the "Powered by mcpxgg" attribution.
 */

import type { GatewayEnv } from './env.js';

export interface ReceiptMeta {
  chain: 'sui';
  network: string;
  amount_atomic: string;
  tool: string;
  server: string;
  /** Present once settled; absent if settlement is async/pending. */
  tx_digest?: string;
  receipt_object_id?: string;
  blob_id?: string;
  settlement: 'settled' | 'pending' | 'free';
  explorer_url?: string;
  attribution: string;
}

export interface BuildMetaInput {
  env: GatewayEnv;
  namespace: string;
  toolName: string;
  chargeAtomic: bigint;
  blobId: string | null;
  txDigest?: string;
  receiptObjectId?: string;
  settlement: 'settled' | 'pending' | 'free';
}

function explorerBase(network: string): string {
  if (network === 'sui-mainnet') return 'https://suiscan.xyz/mainnet/tx';
  if (network === 'sui-testnet') return 'https://suiscan.xyz/testnet/tx';
  return 'https://suiscan.xyz/devnet/tx';
}

export function buildReceiptMeta(i: BuildMetaInput): ReceiptMeta {
  return {
    chain: 'sui',
    network: i.env.network,
    amount_atomic: i.chargeAtomic.toString(),
    tool: i.toolName,
    server: i.namespace,
    settlement: i.settlement,
    attribution: i.env.attribution,
    ...(i.txDigest ? { tx_digest: i.txDigest } : {}),
    ...(i.receiptObjectId ? { receipt_object_id: i.receiptObjectId } : {}),
    ...(i.blobId ? { blob_id: i.blobId } : {}),
    ...(i.txDigest ? { explorer_url: `${explorerBase(i.env.network)}/${i.txDigest}` } : {}),
  };
}
