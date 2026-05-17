/**
 * walrus-search MCP server (S3-T12..T14). Tools per spec §10.1:
 *   index        — embed + upsert documents, archive the corpus to Walrus
 *   query        — semantic search over an index
 *   delete_index — drop an index
 *
 * The vector store and embedder are injected so tests are hermetic and prod
 * can swap in Qdrant + OpenAI without touching tool logic.
 */

import { createMCPXServer, type MCPXServer } from '@mcpxgg/server';
import { createWalrusClient, walrusEnv, type WalrusClient } from '@mcpxgg/walrus';
import { embedderFromEnv, type Embedder } from './embeddings.js';
import {
  createInMemoryVectorStore,
  type VectorDoc,
  type VectorStore,
} from './vector-store.js';

export interface WalrusSearchDeps {
  embedder?: Embedder;
  vectorStore?: VectorStore;
  walrus?: WalrusClient;
}

const indexDocSchema = {
  type: 'object',
  properties: {
    indexName: { type: 'string', description: 'Logical index to write to' },
    documents: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          text: { type: 'string' },
          metadata: { type: 'object' },
        },
        required: ['id', 'text'],
      },
    },
  },
  required: ['indexName', 'documents'],
} as const;

export function createWalrusSearchServer(deps: WalrusSearchDeps = {}): MCPXServer {
  const embedder = deps.embedder ?? embedderFromEnv();
  const store = deps.vectorStore ?? createInMemoryVectorStore();
  const walrus = deps.walrus ?? createWalrusClient(walrusEnv());
  // index → Walrus blob id of the last archived corpus snapshot.
  const corpusBlob = new Map<string, string>();

  const server = createMCPXServer({
    namespace: 'walrus-search',
    description: 'Semantic search over documents, durably archived to Walrus.',
  });

  server.tool('index', {
    description: 'Embed and index documents. The corpus is archived to Walrus and the blob id returned.',
    inputSchema: indexDocSchema as unknown as Record<string, unknown>,
    pricing: { perCallAtomic: 10_000n },
    timeoutSeconds: 60,
    handler: async (args) => {
      const indexName = String(args.indexName ?? '');
      const documents = (args.documents as VectorDoc[] | undefined) ?? [];
      if (!indexName) throw new Error('indexName is required');
      if (!Array.isArray(documents) || documents.length === 0) {
        throw new Error('documents must be a non-empty array');
      }
      const stored = await Promise.all(
        documents.map(async (d) => ({
          id: String(d.id),
          text: String(d.text),
          ...(d.metadata ? { metadata: d.metadata } : {}),
          vector: await embedder.embed(String(d.text)),
        })),
      );
      await store.upsert(indexName, stored);
      const { blobId } = await walrus.uploadJSON({
        v: 1,
        indexName,
        documents: documents.map((d) => ({
          id: d.id,
          text: d.text,
          metadata: d.metadata ?? {},
        })),
      });
      corpusBlob.set(indexName, blobId);
      return {
        indexName,
        indexed: stored.length,
        total: await store.count(indexName),
        blob_id: blobId,
      };
    },
  });

  server.tool('query', {
    description: 'Semantic search. Returns the topK most similar documents with scores.',
    inputSchema: {
      type: 'object',
      properties: {
        indexName: { type: 'string' },
        query: { type: 'string' },
        topK: { type: 'number', description: 'Default 5' },
      },
      required: ['indexName', 'query'],
    },
    pricing: { perCallAtomic: 5_000n, freeTierCallsPerUser: 3 },
    handler: async (args) => {
      const indexName = String(args.indexName ?? '');
      const q = String(args.query ?? '');
      const topK = Number.isFinite(args.topK) ? Number(args.topK) : 5;
      if (!indexName || !q) throw new Error('indexName and query are required');
      const vector = await embedder.embed(q);
      const hits = await store.query(indexName, vector, topK);
      return {
        indexName,
        query: q,
        hits,
        corpus_blob_id: corpusBlob.get(indexName) ?? null,
      };
    },
  });

  server.tool('delete_index', {
    description: 'Delete an index and all of its vectors.',
    inputSchema: {
      type: 'object',
      properties: { indexName: { type: 'string' } },
      required: ['indexName'],
    },
    pricing: { perCallAtomic: 0n },
    handler: async (args) => {
      const indexName = String(args.indexName ?? '');
      if (!indexName) throw new Error('indexName is required');
      const deleted = await store.deleteIndex(indexName);
      corpusBlob.delete(indexName);
      return { indexName, deleted };
    },
  });

  return server;
}
