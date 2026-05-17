/**
 * walrus-store MCP server (S6-T09). Tools per spec §10.4:
 *   upload    — store bytes (base64) + optional metadata → blob_id
 *   retrieve  — blob_id → content (base64) + content-type
 *   metadata  — blob_id → size, content-type, stored_epoch, owner, …
 *   list      — by owner / name prefix → blob ids
 *
 * The Walrus client and the metadata catalog are injected so tests are
 * hermetic and prod can swap in the HTTP Walrus backend + Postgres mirror
 * without touching tool logic. The default factory boots fully offline
 * (in-memory Walrus backend + in-memory catalog) so it is demoable with
 * zero config.
 *
 * Security: `retrieve` / `metadata` take a caller-supplied blob id. Walrus
 * ids are opaque tokens that are only ever echoed, never parsed, but a
 * caller could still pass an arbitrarily long or control-char-laden string;
 * validateBlobId enforces a conservative charset + length bound before the
 * id reaches the backend so it cannot be used for SSRF/path traversal in the
 * HTTP backend's aggregator URL.
 */

import { createMCPXServer, type MCPXServer } from '@mcpxgg/server';
import {
  createWalrusClient,
  walrusEnv,
  WalrusError,
  type WalrusClient,
} from '@mcpxgg/walrus';
import {
  createInMemoryBlobCatalog,
  type BlobCatalog,
  type BlobRecord,
} from './store.js';

export interface WalrusStoreDeps {
  walrus?: WalrusClient;
  catalog?: BlobCatalog;
  /** Override the recorded storage epoch (default: WALRUS_EPOCHS or 1). */
  epoch?: number;
}

const MAX_BLOB_ID_LEN = 256;
const BLOB_ID_RE = /^[A-Za-z0-9:_-]{1,256}$/;
const MAX_UPLOAD_BYTES = 16 * 1024 * 1024;
const MAX_NAME_LEN = 512;
const ANON_OWNER = 'anonymous';

function validateBlobId(raw: unknown): string {
  const id = String(raw ?? '').trim();
  if (!id) throw new Error('blobId is required');
  if (id.length > MAX_BLOB_ID_LEN) throw new Error('blobId is too long');
  if (!BLOB_ID_RE.test(id)) {
    throw new Error('blobId has an invalid format');
  }
  return id;
}

function decodeBase64(raw: unknown): Uint8Array {
  const s = String(raw ?? '');
  if (!s) throw new Error('content (base64) is required');
  let buf: Buffer;
  try {
    buf = Buffer.from(s, 'base64');
  } catch {
    throw new Error('content is not valid base64');
  }
  // Buffer.from is lenient; round-trip to reject silently-truncated input.
  if (buf.toString('base64').replace(/=+$/, '') !== s.replace(/=+$/, '')) {
    throw new Error('content is not valid base64');
  }
  if (buf.byteLength === 0) throw new Error('content is empty');
  if (buf.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error(`content exceeds ${MAX_UPLOAD_BYTES} byte limit`);
  }
  return new Uint8Array(buf);
}

function clampLimit(v: unknown, def: number, max = 200): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

export function createWalrusStoreServer(deps: WalrusStoreDeps = {}): MCPXServer {
  const walrus = deps.walrus ?? createWalrusClient(walrusEnv());
  const catalog = deps.catalog ?? createInMemoryBlobCatalog();
  const epoch =
    deps.epoch ??
    (process.env.WALRUS_EPOCHS ? Number.parseInt(process.env.WALRUS_EPOCHS, 10) : 1);

  const server = createMCPXServer({
    namespace: 'walrus-store',
    description:
      'Agent-native blob storage on Walrus. Upload bytes, retrieve by id, ' +
      'inspect metadata, and list your blobs — every call settles in USDsui.',
  });

  server.tool('upload', {
    description:
      'Store a blob on Walrus. Content is base64-encoded bytes; optional name ' +
      'and metadata are recorded for later listing. Returns the Walrus blob id.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Base64-encoded bytes to store' },
        contentType: {
          type: 'string',
          description: 'MIME type to record (default application/octet-stream)',
        },
        name: {
          type: 'string',
          description: 'Logical name/path for prefix listing (optional)',
        },
        metadata: {
          type: 'object',
          description: 'Arbitrary JSON metadata recorded alongside the blob',
        },
      },
      required: ['content'],
    },
    pricing: { perCallAtomic: 12_000n, freeTierCallsPerUser: 1 },
    timeoutSeconds: 60,
    handler: async (args, ctx) => {
      const bytes = decodeBase64(args.content);
      const contentType =
        typeof args.contentType === 'string' && args.contentType.trim()
          ? args.contentType.trim().slice(0, 128)
          : 'application/octet-stream';
      const name =
        typeof args.name === 'string' ? args.name.slice(0, MAX_NAME_LEN) : '';
      const metadata =
        args.metadata && typeof args.metadata === 'object' && !Array.isArray(args.metadata)
          ? (args.metadata as Record<string, unknown>)
          : {};

      const { blobId, size } = await walrus.upload(bytes, contentType);
      const record: BlobRecord = {
        blobId,
        size,
        contentType,
        storedEpoch: epoch,
        uploadedAt: Date.now(),
        owner: ctx.payerAddress ?? ANON_OWNER,
        name,
        metadata,
      };
      await catalog.put(record);
      return {
        blob_id: blobId,
        size,
        content_type: contentType,
        stored_epoch: epoch,
        owner: record.owner,
        name,
      };
    },
  });

  server.tool('retrieve', {
    description: 'Fetch a blob by its Walrus id. Content is returned base64-encoded.',
    inputSchema: {
      type: 'object',
      properties: {
        blobId: { type: 'string', description: 'Walrus blob id' },
      },
      required: ['blobId'],
    },
    pricing: { perCallAtomic: 4_000n, freeTierCallsPerUser: 3 },
    handler: async (args) => {
      const blobId = validateBlobId(args.blobId);
      let bytes: Uint8Array;
      try {
        bytes = await walrus.retrieve(blobId);
      } catch (e) {
        if (e instanceof WalrusError && e.code === 'not_found') {
          throw new Error(`blob ${blobId} not found`);
        }
        throw e;
      }
      const record = await catalog.get(blobId);
      return {
        blob_id: blobId,
        size: bytes.byteLength,
        content_type: record?.contentType ?? 'application/octet-stream',
        content: Buffer.from(bytes).toString('base64'),
      };
    },
  });

  server.tool('metadata', {
    description:
      'Return recorded metadata for a blob: size, content-type, stored epoch, ' +
      'owner, name and any custom metadata supplied at upload time.',
    inputSchema: {
      type: 'object',
      properties: {
        blobId: { type: 'string', description: 'Walrus blob id' },
      },
      required: ['blobId'],
    },
    pricing: { perCallAtomic: 2_000n, freeTierCallsPerUser: 3 },
    handler: async (args) => {
      const blobId = validateBlobId(args.blobId);
      const record = await catalog.get(blobId);
      if (!record) {
        const stillThere = await walrus.has(blobId);
        if (!stillThere) throw new Error(`blob ${blobId} not found`);
        return {
          blob_id: blobId,
          known: false,
          note: 'blob exists on Walrus but was not uploaded through this server',
        };
      }
      return {
        blob_id: blobId,
        known: true,
        size: record.size,
        content_type: record.contentType,
        stored_epoch: record.storedEpoch,
        uploaded_at: record.uploadedAt,
        owner: record.owner,
        name: record.name,
        metadata: record.metadata,
      };
    },
  });

  server.tool('list', {
    description:
      'List blobs uploaded through this server, filtered by owner and/or name ' +
      'prefix, newest first. Owner defaults to the calling payer.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'Owner address to filter by (default: caller)',
        },
        prefix: { type: 'string', description: 'Name prefix to filter by' },
        limit: { type: 'number', description: 'Max rows (1..200), default 50' },
      },
      required: [],
    },
    pricing: { perCallAtomic: 1_000n, freeTierCallsPerUser: 3 },
    handler: async (args, ctx) => {
      const owner =
        typeof args.owner === 'string' && args.owner.trim()
          ? args.owner.trim()
          : (ctx.payerAddress ?? ANON_OWNER);
      const prefix = typeof args.prefix === 'string' ? args.prefix : '';
      const limit = clampLimit(args.limit, 50);
      const rows = await catalog.list(owner, prefix, limit);
      return {
        owner,
        prefix,
        count: rows.length,
        blobs: rows.map((r) => ({
          blob_id: r.blobId,
          name: r.name,
          size: r.size,
          content_type: r.contentType,
          stored_epoch: r.storedEpoch,
          uploaded_at: r.uploadedAt,
        })),
      };
    },
  });

  return server;
}
