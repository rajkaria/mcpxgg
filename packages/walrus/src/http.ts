/**
 * Real Walrus backend: HTTP publisher (PUT /v1/blobs) + aggregator
 * (GET /v1/blobs/{blobId}). This is the only file in the package that
 * touches the network.
 *
 * Publisher response shape (Walrus testnet/mainnet):
 *   { "newlyCreated": { "blobObject": { "blobId": "..." } } }     — first write
 *   { "alreadyCertified": { "blobId": "..." } }                   — dedup hit
 */

import type { StoredBlob, WalrusBackend } from './backend.js';
import { WalrusError } from './backend.js';

export interface HttpWalrusOptions {
  publisherUrl: string;
  aggregatorUrl: string;
  /** Permanent retention is the platform default (ADR: permanent receipts). */
  epochs?: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

function extractBlobId(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const newly = b.newlyCreated as Record<string, unknown> | undefined;
  const blobObject = newly?.blobObject as Record<string, unknown> | undefined;
  if (typeof blobObject?.blobId === 'string') return blobObject.blobId;
  const certified = b.alreadyCertified as Record<string, unknown> | undefined;
  if (typeof certified?.blobId === 'string') return certified.blobId;
  return null;
}

export function createHttpWalrusBackend(opts: HttpWalrusOptions): WalrusBackend {
  const publisher = opts.publisherUrl.replace(/\/+$/, '');
  const aggregator = opts.aggregatorUrl.replace(/\/+$/, '');
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const epochs = opts.epochs ?? 200;

  async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fn(controller.signal);
    } finally {
      clearTimeout(t);
    }
  }

  return {
    async store(data: Uint8Array): Promise<StoredBlob> {
      const res = await withTimeout((signal) =>
        fetchImpl(`${publisher}/v1/blobs?epochs=${epochs}`, {
          method: 'PUT',
          body: data as unknown as BodyInit,
          signal,
        }),
      ).catch((e: unknown) => {
        throw new WalrusError('upload_failed', `walrus publisher unreachable: ${String(e)}`);
      });
      if (!res.ok) {
        throw new WalrusError('upload_failed', `walrus publisher http ${res.status}`);
      }
      const blobId = extractBlobId(await res.json().catch(() => null));
      if (!blobId) {
        throw new WalrusError('upload_failed', 'walrus publisher returned no blobId');
      }
      return { blobId, size: data.byteLength };
    },

    async read(blobId: string): Promise<Uint8Array> {
      const res = await withTimeout((signal) =>
        fetchImpl(`${aggregator}/v1/blobs/${encodeURIComponent(blobId)}`, { signal }),
      ).catch((e: unknown) => {
        throw new WalrusError('retrieve_failed', `walrus aggregator unreachable: ${String(e)}`);
      });
      if (res.status === 404) {
        throw new WalrusError('not_found', `blob ${blobId} not found on aggregator`);
      }
      if (!res.ok) {
        throw new WalrusError('retrieve_failed', `walrus aggregator http ${res.status}`);
      }
      return new Uint8Array(await res.arrayBuffer());
    },

    async has(blobId: string): Promise<boolean> {
      try {
        const res = await withTimeout((signal) =>
          fetchImpl(`${aggregator}/v1/blobs/${encodeURIComponent(blobId)}`, {
            method: 'HEAD',
            signal,
          }),
        );
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
