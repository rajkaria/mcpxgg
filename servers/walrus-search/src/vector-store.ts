/**
 * VectorStore seam. The in-memory cosine store is the default (hermetic CI,
 * fine for anchor-scale corpora). Qdrant/Pinecone implement the same
 * interface for production scale — see README.
 */

export interface VectorDoc {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface StoredVector extends VectorDoc {
  vector: number[];
}

export interface QueryHit {
  id: string;
  score: number;
  text: string;
  metadata: Record<string, unknown>;
}

export interface VectorStore {
  upsert(indexName: string, docs: StoredVector[]): Promise<void>;
  query(indexName: string, vector: number[], topK: number): Promise<QueryHit[]>;
  deleteIndex(indexName: string): Promise<boolean>;
  count(indexName: string): Promise<number>;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function createInMemoryVectorStore(): VectorStore {
  const indexes = new Map<string, Map<string, StoredVector>>();

  return {
    async upsert(indexName, docs) {
      let idx = indexes.get(indexName);
      if (!idx) {
        idx = new Map();
        indexes.set(indexName, idx);
      }
      for (const d of docs) idx.set(d.id, d);
    },
    async query(indexName, vector, topK) {
      const idx = indexes.get(indexName);
      if (!idx) return [];
      return [...idx.values()]
        .map((d) => ({
          id: d.id,
          score: cosine(vector, d.vector),
          text: d.text,
          metadata: d.metadata ?? {},
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(0, topK));
    },
    async deleteIndex(indexName) {
      return indexes.delete(indexName);
    },
    async count(indexName) {
      return indexes.get(indexName)?.size ?? 0;
    },
  };
}
