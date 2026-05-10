/**
 * @mcpxgg/walrus — Walrus + Seal client wrapper.
 *
 * Wired in Sprint 0 (spike) and Sprint 4 (production).
 */

export const PACKAGE_VERSION = '0.1.0';

export interface UploadOptions {
  contentType?: string;
  retention?: 'permanent' | 'short';
  encryptedFor?: string[]; // Seal recipient addresses
}

export interface BlobMetadata {
  blobId: string;
  size: number;
  contentType: string;
  uploadedAt: number;
  isEncrypted: boolean;
}

export async function upload(_data: Uint8Array, _opts?: UploadOptions): Promise<BlobMetadata> {
  throw new Error('walrus.upload — wired in Sprint 0 spike, see docs/SPRINTS.md S0-T10');
}

export async function retrieve(_blobId: string): Promise<Uint8Array> {
  throw new Error('walrus.retrieve — wired in Sprint 0 spike, see docs/SPRINTS.md S0-T10');
}

export async function metadata(_blobId: string): Promise<BlobMetadata> {
  throw new Error('walrus.metadata — wired in Sprint 0 spike, see docs/SPRINTS.md S0-T10');
}

// Seal helpers
export async function sealEncrypt(
  _data: Uint8Array,
  _recipients: string[],
): Promise<{ ciphertext: Uint8Array; encryptedKeys: Record<string, Uint8Array> }> {
  throw new Error('walrus.sealEncrypt — wired in Sprint 0 spike, see docs/SPRINTS.md S0-T11');
}

export async function sealDecrypt(_ciphertext: Uint8Array, _myKey: Uint8Array): Promise<Uint8Array> {
  throw new Error('walrus.sealDecrypt — wired in Sprint 0 spike, see docs/SPRINTS.md S0-T11');
}
