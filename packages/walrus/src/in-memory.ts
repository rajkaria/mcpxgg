/**
 * In-memory WalrusBackend. Deterministic, no network. Used by every test and
 * by `pnpm dev` when no Walrus publisher is configured.
 */

import type { StoredBlob, WalrusBackend } from './backend.js';
import { WalrusError } from './backend.js';
import { contentBlobId } from './hash.js';

export interface InMemoryWalrusBackend extends WalrusBackend {
  /** Number of distinct blobs stored. */
  readonly count: number;
  /** Clear all blobs (test helper). */
  reset(): void;
}

export function createInMemoryWalrusBackend(): InMemoryWalrusBackend {
  const blobs = new Map<string, Uint8Array>();

  return {
    async store(data: Uint8Array): Promise<StoredBlob> {
      const blobId = contentBlobId(data);
      // Content-addressed: identical bytes → identical id → idempotent store.
      if (!blobs.has(blobId)) blobs.set(blobId, Uint8Array.from(data));
      return { blobId, size: data.byteLength };
    },

    async read(blobId: string): Promise<Uint8Array> {
      const found = blobs.get(blobId);
      if (!found) {
        throw new WalrusError('not_found', `blob ${blobId} not in memory backend`);
      }
      return Uint8Array.from(found);
    },

    async has(blobId: string): Promise<boolean> {
      return blobs.has(blobId);
    },

    get count(): number {
      return blobs.size;
    },

    reset(): void {
      blobs.clear();
    },
  };
}
