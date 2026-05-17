/**
 * WalrusBackend — the storage boundary. The high-level client works against
 * this interface; the gateway and walrus-search inject either the real HTTP
 * backend (publisher/aggregator) or the in-memory backend (tests + local dev).
 *
 * Same boundary discipline as `packages/chain` (ChainAdapter) and the
 * facilitator's SuiBackend: only `http.ts` ever touches the network.
 */

export interface StoredBlob {
  blobId: string;
  size: number;
}

export interface WalrusBackend {
  /** Store raw bytes. Returns the content-addressed blob id. */
  store(data: Uint8Array): Promise<StoredBlob>;
  /** Read raw bytes for a blob id. Throws WalrusError('not_found') if absent. */
  read(blobId: string): Promise<Uint8Array>;
  /** True if the blob is retrievable. */
  has(blobId: string): Promise<boolean>;
}

export type WalrusErrorCode =
  | 'not_found'
  | 'upload_failed'
  | 'retrieve_failed'
  | 'config_error';

export class WalrusError extends Error {
  override readonly name = 'WalrusError';
  constructor(
    readonly code: WalrusErrorCode,
    message: string,
  ) {
    super(message);
  }
}
