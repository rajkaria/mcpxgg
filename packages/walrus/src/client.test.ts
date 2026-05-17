import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWalrusClient,
  createInMemoryWalrusBackend,
  createHttpWalrusBackend,
  walrusEnv,
  sealEncrypt,
  sealDecrypt,
  WalrusError,
} from './index.js';

test('in-memory client round-trips JSON', async () => {
  const w = createWalrusClient();
  const { blobId, contentType } = await w.uploadJSON({ hello: 'world', n: 42 });
  assert.equal(contentType, 'application/json');
  const back = await w.retrieveJSON<{ hello: string; n: number }>(blobId);
  assert.deepEqual(back, { hello: 'world', n: 42 });
  assert.equal(await w.has(blobId), true);
});

test('content-addressed: same bytes → same blob id, idempotent store', async () => {
  const be = createInMemoryWalrusBackend();
  const a = await be.store(new TextEncoder().encode('same'));
  const b = await be.store(new TextEncoder().encode('same'));
  assert.equal(a.blobId, b.blobId);
  assert.equal(be.count, 1);
});

test('retrieve missing blob throws not_found', async () => {
  const w = createWalrusClient();
  await assert.rejects(
    () => w.retrieve('mem:does-not-exist'),
    (e: unknown) => e instanceof WalrusError && e.code === 'not_found',
  );
});

test('retrieveJSON on non-JSON bytes throws retrieve_failed', async () => {
  const w = createWalrusClient();
  const { blobId } = await w.upload(new Uint8Array([0xff, 0x00, 0x01]));
  await assert.rejects(
    () => w.retrieveJSON(blobId),
    (e: unknown) => e instanceof WalrusError && e.code === 'retrieve_failed',
  );
});

test('walrusEnv returns null when unconfigured, parsed when set', () => {
  assert.equal(walrusEnv({} as NodeJS.ProcessEnv), null);
  const cfg = walrusEnv({
    WALRUS_PUBLISHER_URL: 'https://pub',
    WALRUS_AGGREGATOR_URL: 'https://agg',
    WALRUS_EPOCHS: '50',
  } as unknown as NodeJS.ProcessEnv);
  assert.deepEqual(cfg, {
    publisherUrl: 'https://pub',
    aggregatorUrl: 'https://agg',
    epochs: 50,
  });
});

test('http backend parses newlyCreated and alreadyCertified shapes', async () => {
  const calls: string[] = [];
  const fakeFetch: typeof fetch = (async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (init?.method === 'PUT') {
      return new Response(
        JSON.stringify({ newlyCreated: { blobObject: { blobId: 'walrus_abc' } } }),
        { status: 200 },
      );
    }
    return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
  }) as unknown as typeof fetch;

  const be = createHttpWalrusBackend({
    publisherUrl: 'https://pub/',
    aggregatorUrl: 'https://agg/',
    fetchImpl: fakeFetch,
  });
  const stored = await be.store(new Uint8Array([9]));
  assert.equal(stored.blobId, 'walrus_abc');
  const back = await be.read('walrus_abc');
  assert.deepEqual([...back], [1, 2, 3]);
  assert.ok(calls[0]?.startsWith('PUT https://pub/v1/blobs?epochs='));
});

test('seal passthrough envelope round-trips', () => {
  const env = sealEncrypt(new TextEncoder().encode('secret'), ['0xowner']);
  assert.equal(env.scheme, 'plaintext-passthrough-v0');
  assert.deepEqual(env.recipients, ['0xowner']);
  assert.equal(new TextDecoder().decode(sealDecrypt(env)), 'secret');
});
