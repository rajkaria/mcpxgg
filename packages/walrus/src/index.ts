/**
 * @mcpxgg/walrus — Walrus + Seal client wrapper.
 *
 * High-level API used by the gateway (S3-T05, archive request/response) and
 * walrus-search (S3-T13, persist indexed documents).
 *
 *   const walrus = createWalrusClient();              // in-memory (dev/test)
 *   const walrus = createWalrusClient(walrusEnv());    // HTTP (prod)
 *   const { blobId } = await walrus.uploadJSON({ ... });
 *   const obj = await walrus.retrieveJSON(blobId);
 */

import type { WalrusBackend } from './backend';
import { WalrusError } from './backend';
import { createInMemoryWalrusBackend } from './in-memory';
import { createHttpWalrusBackend } from './http';

export const PACKAGE_VERSION = '0.2.0';

export type { WalrusBackend, StoredBlob, WalrusErrorCode } from './backend';
export { WalrusError } from './backend';
export { createInMemoryWalrusBackend } from './in-memory';
export type { InMemoryWalrusBackend } from './in-memory';
export { createHttpWalrusBackend } from './http';
export type { HttpWalrusOptions } from './http';
export { sealEncrypt, sealDecrypt } from './seal';
export type { SealEnvelope } from './seal';

export interface BlobMetadata {
  blobId: string;
  size: number;
  contentType: string;
  uploadedAt: number;
}

export interface WalrusClient {
  upload(data: Uint8Array, contentType?: string): Promise<BlobMetadata>;
  uploadJSON(value: unknown): Promise<BlobMetadata>;
  retrieve(blobId: string): Promise<Uint8Array>;
  retrieveJSON<T = unknown>(blobId: string): Promise<T>;
  has(blobId: string): Promise<boolean>;
  readonly backend: WalrusBackend;
}

export interface WalrusEnv {
  publisherUrl?: string;
  aggregatorUrl?: string;
  epochs?: number;
}

/**
 * Reads Walrus config from the environment. Returns `null` if not configured
 * (callers fall back to the in-memory backend — never a hard failure in dev).
 */
export function walrusEnv(env: NodeJS.ProcessEnv = process.env): WalrusEnv | null {
  const publisherUrl = env.WALRUS_PUBLISHER_URL;
  const aggregatorUrl = env.WALRUS_AGGREGATOR_URL;
  if (!publisherUrl || !aggregatorUrl) return null;
  return {
    publisherUrl,
    aggregatorUrl,
    ...(env.WALRUS_EPOCHS ? { epochs: Number.parseInt(env.WALRUS_EPOCHS, 10) } : {}),
  };
}

export function createWalrusClient(cfg?: WalrusEnv | null): WalrusClient {
  const backend: WalrusBackend =
    cfg && cfg.publisherUrl && cfg.aggregatorUrl
      ? createHttpWalrusBackend({
          publisherUrl: cfg.publisherUrl,
          aggregatorUrl: cfg.aggregatorUrl,
          ...(cfg.epochs ? { epochs: cfg.epochs } : {}),
        })
      : createInMemoryWalrusBackend();

  return {
    backend,

    async upload(data: Uint8Array, contentType = 'application/octet-stream'): Promise<BlobMetadata> {
      const { blobId, size } = await backend.store(data);
      return { blobId, size, contentType, uploadedAt: Date.now() };
    },

    async uploadJSON(value: unknown): Promise<BlobMetadata> {
      const bytes = new TextEncoder().encode(JSON.stringify(value));
      const { blobId, size } = await backend.store(bytes);
      return { blobId, size, contentType: 'application/json', uploadedAt: Date.now() };
    },

    async retrieve(blobId: string): Promise<Uint8Array> {
      return backend.read(blobId);
    },

    async retrieveJSON<T = unknown>(blobId: string): Promise<T> {
      const bytes = await backend.read(blobId);
      try {
        return JSON.parse(new TextDecoder().decode(bytes)) as T;
      } catch (e) {
        throw new WalrusError('retrieve_failed', `blob ${blobId} is not valid JSON: ${String(e)}`);
      }
    },

    async has(blobId: string): Promise<boolean> {
      return backend.has(blobId);
    },
  };
}

/** Process-default client. In-memory unless WALRUS_* env is set. */
let defaultClient: WalrusClient | null = null;
export function getDefaultWalrusClient(): WalrusClient {
  if (!defaultClient) defaultClient = createWalrusClient(walrusEnv());
  return defaultClient;
}
