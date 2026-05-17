import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWalrusClient } from '@mcpxgg/walrus';
import { createLocalEmbedder } from './embeddings.js';
import { createInMemoryVectorStore } from './vector-store.js';
import { createWalrusSearchServer } from './server.js';

function rpc(
  server: ReturnType<typeof createWalrusSearchServer>,
  name: string,
  args: Record<string, unknown>,
) {
  return Promise.resolve(
    server.fetch(
      new Request('http://s/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name, arguments: args },
        }),
      }),
    ),
  ).then(
    (r) =>
      r.json() as Promise<{ result: { content: Array<{ text: string }>; isError: boolean } }>,
  );
}

test('local embedder is deterministic and L2-normalised', async () => {
  const e = createLocalEmbedder();
  const a = await e.embed('sui move smart contract');
  const b = await e.embed('sui move smart contract');
  assert.deepEqual(a, b);
  const norm = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
  assert.ok(Math.abs(norm - 1) < 1e-9);
});

test('vector store ranks the semantically closest doc first', async () => {
  const e = createLocalEmbedder();
  const vs = createInMemoryVectorStore();
  await vs.upsert('i', [
    { id: 'a', text: 'walrus decentralized blob storage', vector: await e.embed('walrus decentralized blob storage') },
    { id: 'b', text: 'cooking pasta recipes', vector: await e.embed('cooking pasta recipes') },
  ]);
  const hits = await vs.query('i', await e.embed('blob storage on walrus'), 2);
  assert.equal(hits[0]?.id, 'a');
  assert.ok((hits[0]?.score ?? 0) > (hits[1]?.score ?? 1));
});

test('index → query → delete_index full flow over MCP JSON-RPC', async () => {
  const server = createWalrusSearchServer({
    embedder: createLocalEmbedder(),
    vectorStore: createInMemoryVectorStore(),
    walrus: createWalrusClient(),
  });

  const indexed = await rpc(server, 'index', {
    indexName: 'kb',
    documents: [
      { id: 'd1', text: 'Sui uses an object-centric model and Move' },
      { id: 'd2', text: 'Walrus stores large blobs with erasure coding' },
      { id: 'd3', text: 'x402 is an HTTP-native micropayment protocol' },
    ],
  });
  assert.equal(indexed.result.isError, false);
  const idxBody = JSON.parse(indexed.result.content[0]!.text) as {
    indexed: number;
    blob_id: string;
  };
  assert.equal(idxBody.indexed, 3);
  assert.ok(idxBody.blob_id.startsWith('mem:'), 'corpus archived to Walrus');

  const q = await rpc(server, 'query', { indexName: 'kb', query: 'how does Walrus store blobs', topK: 2 });
  const qBody = JSON.parse(q.result.content[0]!.text) as {
    hits: Array<{ id: string }>;
    corpus_blob_id: string;
  };
  assert.equal(qBody.hits[0]?.id, 'd2');
  assert.equal(qBody.corpus_blob_id, idxBody.blob_id);

  const del = await rpc(server, 'delete_index', { indexName: 'kb' });
  const delBody = JSON.parse(del.result.content[0]!.text) as { deleted: boolean };
  assert.equal(delBody.deleted, true);

  const empty = await rpc(server, 'query', { indexName: 'kb', query: 'anything' });
  const emptyBody = JSON.parse(empty.result.content[0]!.text) as { hits: unknown[] };
  assert.equal(emptyBody.hits.length, 0);
});

test('index rejects empty documents', async () => {
  const server = createWalrusSearchServer({ embedder: createLocalEmbedder() });
  const r = await rpc(server, 'index', { indexName: 'x', documents: [] });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0]!.text, /non-empty/);
});

test('manifest exposes all three tools with string prices', () => {
  const m = createWalrusSearchServer({ embedder: createLocalEmbedder() }).manifest();
  const names = m.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ['delete_index', 'index', 'query']);
  const query = m.tools.find((t) => t.name === 'query');
  assert.equal(query?.priceAtomic, '5000');
  assert.equal(query?.freeTierCallsPerUser, 3);
});
