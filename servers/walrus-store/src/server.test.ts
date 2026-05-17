import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWalrusClient } from '@mcpxgg/walrus';
import { createWalrusStoreServer } from './server.js';
import { createInMemoryBlobCatalog } from './store.js';

function rpc(
  server: ReturnType<typeof createWalrusStoreServer>,
  name: string,
  args: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return Promise.resolve(
    server.fetch(
      new Request('http://s/', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
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
      r.json() as Promise<{
        result: { content: Array<{ text: string }>; isError: boolean };
      }>,
  );
}

function body<T>(r: { result: { content: Array<{ text: string }> } }): T {
  return JSON.parse(r.result.content[0]!.text) as T;
}

function makeServer() {
  return createWalrusStoreServer({
    walrus: createWalrusClient(),
    catalog: createInMemoryBlobCatalog(),
    epoch: 7,
  });
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

test('manifest exposes all four tools with string bigint prices', () => {
  const m = makeServer().manifest();
  const names = m.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ['list', 'metadata', 'retrieve', 'upload']);
  assert.equal(m.tools.find((t) => t.name === 'upload')?.priceAtomic, '12000');
  assert.equal(m.tools.find((t) => t.name === 'upload')?.freeTierCallsPerUser, 1);
  assert.equal(m.tools.find((t) => t.name === 'retrieve')?.priceAtomic, '4000');
  assert.equal(m.tools.find((t) => t.name === 'metadata')?.priceAtomic, '2000');
  assert.equal(m.tools.find((t) => t.name === 'list')?.priceAtomic, '1000');
});

test('upload → retrieve round-trips the exact bytes', async () => {
  const s = makeServer();
  const up = body<{ blob_id: string; size: number; content_type: string }>(
    await rpc(s, 'upload', {
      content: b64('hello walrus'),
      contentType: 'text/plain',
      name: 'docs/readme.txt',
    }),
  );
  assert.ok(up.blob_id.length > 0);
  assert.equal(up.size, 'hello walrus'.length);
  assert.equal(up.content_type, 'text/plain');

  const got = body<{ content: string; content_type: string; size: number }>(
    await rpc(s, 'retrieve', { blobId: up.blob_id }),
  );
  assert.equal(Buffer.from(got.content, 'base64').toString('utf8'), 'hello walrus');
  assert.equal(got.content_type, 'text/plain');
  assert.equal(got.size, 'hello walrus'.length);
});

test('upload is content-addressed (idempotent for identical bytes)', async () => {
  const s = makeServer();
  const a = body<{ blob_id: string }>(await rpc(s, 'upload', { content: b64('same') }));
  const b = body<{ blob_id: string }>(await rpc(s, 'upload', { content: b64('same') }));
  assert.equal(a.blob_id, b.blob_id);
});

test('upload: empty content is rejected', async () => {
  const r = await rpc(makeServer(), 'upload', { content: '' });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0]!.text, /content \(base64\) is required/);
});

test('upload: non-base64 content is rejected', async () => {
  const r = await rpc(makeServer(), 'upload', { content: 'not valid base64 !!!' });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0]!.text, /not valid base64/);
});

test('metadata returns recorded fields incl. stored_epoch and custom metadata', async () => {
  const s = makeServer();
  const up = body<{ blob_id: string }>(
    await rpc(
      s,
      'upload',
      {
        content: b64('payload'),
        contentType: 'application/json',
        name: 'a/b.json',
        metadata: { tag: 'demo', version: 2 },
      },
      { 'x-mcpx-payer': '0xdead' },
    ),
  );
  const md = body<{
    known: boolean;
    size: number;
    content_type: string;
    stored_epoch: number;
    owner: string;
    name: string;
    metadata: Record<string, unknown>;
  }>(await rpc(s, 'metadata', { blobId: up.blob_id }));
  assert.equal(md.known, true);
  assert.equal(md.size, 'payload'.length);
  assert.equal(md.content_type, 'application/json');
  assert.equal(md.stored_epoch, 7);
  assert.equal(md.owner, '0xdead');
  assert.equal(md.name, 'a/b.json');
  assert.deepEqual(md.metadata, { tag: 'demo', version: 2 });
});

test('metadata: unknown blob id is a not-found error', async () => {
  const r = await rpc(makeServer(), 'metadata', { blobId: 'mem:doesnotexist' });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0]!.text, /not found/);
});

test('retrieve: unknown blob id is a not-found error', async () => {
  const r = await rpc(makeServer(), 'retrieve', { blobId: 'mem:missing' });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0]!.text, /not found/);
});

test('retrieve: malformed blob id is rejected before hitting the backend', async () => {
  for (const bad of ['', '   ', 'has spaces', '../etc/passwd', 'a/b', 'x'.repeat(300)]) {
    const r = await rpc(makeServer(), 'retrieve', { blobId: bad });
    assert.equal(r.result.isError, true, `expected reject for ${JSON.stringify(bad)}`);
    assert.match(r.result.content[0]!.text, /blobId (is required|is too long|has an invalid format)/);
  }
});

test('list: filters by owner and prefix, newest first, defaults owner to payer', async () => {
  const s = makeServer();
  await rpc(s, 'upload', { content: b64('one'), name: 'logs/1' }, { 'x-mcpx-payer': '0xa' });
  await rpc(s, 'upload', { content: b64('two'), name: 'logs/2' }, { 'x-mcpx-payer': '0xa' });
  await rpc(s, 'upload', { content: b64('three'), name: 'pics/3' }, { 'x-mcpx-payer': '0xa' });
  await rpc(s, 'upload', { content: b64('four'), name: 'logs/4' }, { 'x-mcpx-payer': '0xb' });

  const mine = body<{ owner: string; count: number; blobs: Array<{ name: string }> }>(
    await rpc(s, 'list', { prefix: 'logs/' }, { 'x-mcpx-payer': '0xa' }),
  );
  assert.equal(mine.owner, '0xa');
  assert.equal(mine.count, 2);
  assert.deepEqual(
    mine.blobs.map((b) => b.name),
    ['logs/2', 'logs/1'],
  );

  const other = body<{ count: number }>(
    await rpc(s, 'list', { owner: '0xb' }, { 'x-mcpx-payer': '0xa' }),
  );
  assert.equal(other.count, 1);
});

test('list: empty catalog returns zero rows', async () => {
  const r = body<{ count: number; blobs: unknown[] }>(
    await rpc(makeServer(), 'list', {}),
  );
  assert.equal(r.count, 0);
  assert.deepEqual(r.blobs, []);
});

test('list: limit is clamped into 1..200', async () => {
  const s = makeServer();
  for (let i = 0; i < 5; i++) {
    await rpc(s, 'upload', { content: b64(`f${i}`), name: `f${i}` }, { 'x-mcpx-payer': '0xz' });
  }
  const r = body<{ count: number }>(
    await rpc(s, 'list', { limit: 2 }, { 'x-mcpx-payer': '0xz' }),
  );
  assert.equal(r.count, 2);
  const big = body<{ count: number }>(
    await rpc(s, 'list', { limit: 9999 }, { 'x-mcpx-payer': '0xz' }),
  );
  assert.equal(big.count, 5);
});

test('boots offline with zero config (default factory)', async () => {
  const s = createWalrusStoreServer();
  const up = body<{ blob_id: string }>(
    await rpc(s, 'upload', { content: b64('offline') }),
  );
  const got = body<{ content: string }>(
    await rpc(s, 'retrieve', { blobId: up.blob_id }),
  );
  assert.equal(Buffer.from(got.content, 'base64').toString('utf8'), 'offline');
});
