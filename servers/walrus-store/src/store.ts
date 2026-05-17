/**
 * BlobCatalog — the metadata + ownership index that sits in front of the raw
 * WalrusClient. Walrus itself is content-addressed and stores only bytes; it
 * has no notion of "owner", "prefix", or "content-type". This catalog records
 * that side-band metadata so `metadata` and `list` can answer without a chain
 * round-trip. In production this is the indexer mirror (Postgres); the default
 * factory is an in-memory map so the server boots fully offline.
 */

export interface BlobRecord {
  blobId: string;
  size: number;
  contentType: string;
  storedEpoch: number;
  uploadedAt: number;
  owner: string;
  name: string;
  metadata: Record<string, unknown>;
}

export interface BlobCatalog {
  put(record: BlobRecord): Promise<void>;
  get(blobId: string): Promise<BlobRecord | null>;
  list(owner: string, prefix: string, limit: number): Promise<BlobRecord[]>;
}

export function createInMemoryBlobCatalog(): BlobCatalog {
  const byId = new Map<string, BlobRecord>();
  // Monotonic insertion order is the newest-first tiebreaker: uploads within
  // the same millisecond have identical uploadedAt, so wall-clock alone is
  // not a stable sort key.
  const seq = new Map<string, number>();
  let next = 0;

  return {
    async put(record: BlobRecord): Promise<void> {
      byId.set(record.blobId, record);
      seq.set(record.blobId, next++);
    },

    async get(blobId: string): Promise<BlobRecord | null> {
      return byId.get(blobId) ?? null;
    },

    async list(owner: string, prefix: string, limit: number): Promise<BlobRecord[]> {
      const out: BlobRecord[] = [];
      for (const r of byId.values()) {
        if (owner && r.owner !== owner) continue;
        if (prefix && !r.name.startsWith(prefix)) continue;
        out.push(r);
      }
      out.sort(
        (a, b) =>
          b.uploadedAt - a.uploadedAt ||
          (seq.get(b.blobId) ?? 0) - (seq.get(a.blobId) ?? 0),
      );
      return out.slice(0, limit);
    },
  };
}
