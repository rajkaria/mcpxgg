import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InMemorySuiAdapter, type SuiTxConfig } from '@mcpxgg/chain';
import { createWalrusClient } from '@mcpxgg/walrus';
import { runPublish, PublishError, type PublishDeps } from './publish.js';

const CFG = {
  namespace: 'pub-test',
  name: 'Publish Test',
  description: 'A server used to exercise the publish dry-run path.',
  category: 'other',
  tags: ['test'],
  triggerPhrases: ['publish me'],
  endpointUrl: 'https://pub-test.example.com',
  tools: [
    {
      name: 'alpha',
      description: 'First tool.',
      priceAtomic: '5000',
      freeTierCallsPerUser: 1,
      timeoutSeconds: 30,
      inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
    },
    {
      name: 'beta',
      description: 'Second tool.',
      priceAtomic: '0',
      freeTierCallsPerUser: 0,
      timeoutSeconds: 10,
      inputSchema: { type: 'object' },
    },
  ],
};

const TX_CONFIG: SuiTxConfig = {
  packageId: '0xpkg',
  coinType: '0xtest::usdsui::USDSUI',
  sessionRegistryId: '0xregistry',
  rpcUrl: 'http://localhost:0',
};

/** Stub tx-builder — no @mysten/sui, deterministic bytes. */
const fakeBuildTx: PublishDeps['buildTx'] = async (args) => ({
  txBytesB64: Buffer.from(
    `publish:${args.namespace}:${args.metadataBlobId}:${args.endpointUrl}`,
  ).toString('base64'),
});

async function writeConfig(cfg: unknown, opts?: { readme?: string }): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'mcpxgg-pub-'));
  await writeFile(join(dir, 'mcpx.config.json'), JSON.stringify(cfg), 'utf8');
  if (opts?.readme) await writeFile(join(dir, 'README.md'), opts.readme, 'utf8');
  return dir;
}

function deps(adapter = new InMemorySuiAdapter()): PublishDeps {
  return {
    adapter,
    walrus: createWalrusClient(),
    healthCheck: async () => ({ ok: true, status: 200 }),
    buildTx: fakeBuildTx,
    txConfig: TX_CONFIG,
  };
}

test('publish dry-run: uploads blobs + assembles tx, no network', async () => {
  const dir = await writeConfig(CFG, { readme: '# Pub Test\nHello.' });
  const result = await runPublish(
    { dir, dryRun: true, skipHealth: false, senderAddress: '0xabc' },
    deps(),
  );
  assert.equal(result.dryRun, true);
  assert.equal(result.namespace, 'pub-test');
  // README + 2 tool schemas + metadata = 4 uploads
  assert.equal(result.uploads.length, 4);
  assert.ok(result.uploads.some((u) => u.name === 'README.md'));
  assert.ok(result.uploads.some((u) => u.name === 'schema:alpha'));
  assert.ok(result.uploads.some((u) => u.name === 'schema:beta'));
  assert.ok(result.uploads.some((u) => u.name === 'metadata.json'));
  assert.ok(Object.keys(result.toolSchemaBlobIds).length === 2);
  const decoded = Buffer.from(result.txBytesB64, 'base64').toString();
  assert.ok(decoded.startsWith('publish:pub-test:'));
  assert.equal(result.serverObjectId, undefined);
  process.exitCode = 0;
});

test('publish dry-run: deterministic blob ids (content-addressed)', async () => {
  const dir = await writeConfig(CFG);
  const a = await runPublish(
    { dir, dryRun: true, skipHealth: true, senderAddress: '0xabc' },
    deps(),
  );
  const b = await runPublish(
    { dir, dryRun: true, skipHealth: true, senderAddress: '0xabc' },
    deps(),
  );
  assert.deepEqual(a.toolSchemaBlobIds, b.toolSchemaBlobIds);
  process.exitCode = 0;
});

test('publish: namespace-taken path errors clearly', async () => {
  const adapter = new InMemorySuiAdapter();
  await adapter.publishServer({
    ownerAddress: '0xabc',
    namespace: 'pub-test',
    endpointUrl: 'https://x',
    metadataBlobId: 'm',
    tools: [],
    category: 'other',
  });
  const dir = await writeConfig(CFG);
  await assert.rejects(
    () =>
      runPublish(
        { dir, dryRun: true, skipHealth: true, senderAddress: '0xabc' },
        deps(adapter),
      ),
    (e: unknown) =>
      e instanceof PublishError && /already registered/.test(e.message),
  );
  process.exitCode = 0;
});

test('publish: health probe failure stops the publish', async () => {
  const dir = await writeConfig(CFG);
  const d = deps();
  d.healthCheck = async () => ({ ok: false, status: 503 });
  await assert.rejects(
    () =>
      runPublish(
        { dir, dryRun: true, skipHealth: false, senderAddress: '0xabc' },
        d,
      ),
    (e: unknown) => e instanceof PublishError && /503/.test(e.message),
  );
  process.exitCode = 0;
});

test('publish: --skip-health bypasses the probe', async () => {
  const dir = await writeConfig(CFG);
  const d = deps();
  d.healthCheck = async () => {
    throw new Error('should not be called');
  };
  const r = await runPublish(
    { dir, dryRun: true, skipHealth: true, senderAddress: '0xabc' },
    d,
  );
  assert.equal(r.namespace, 'pub-test');
  process.exitCode = 0;
});

test('publish: schema-invalid config rejected before any upload', async () => {
  const dir = await writeConfig({ ...CFG, namespace: 'X' });
  await assert.rejects(
    () =>
      runPublish(
        { dir, dryRun: true, skipHealth: true, senderAddress: '0xabc' },
        deps(),
      ),
    (e: unknown) => e instanceof PublishError && /schema validation/.test(e.message),
  );
  process.exitCode = 0;
});

test('publish: absurd price rejected by range check', async () => {
  const dir = await writeConfig({
    ...CFG,
    tools: [{ ...CFG.tools[0], priceAtomic: '9000000000000000' }],
  });
  await assert.rejects(
    () =>
      runPublish(
        { dir, dryRun: true, skipHealth: true, senderAddress: '0xabc' },
        deps(),
      ),
    (e: unknown) => e instanceof PublishError && /price validation/.test(e.message),
  );
  process.exitCode = 0;
});

test('publish: non-dry-run with no key surfaces signing instructions', async () => {
  const dir = await writeConfig(CFG);
  await assert.rejects(
    () =>
      runPublish(
        { dir, dryRun: false, skipHealth: true, senderAddress: '0xabc' },
        deps(),
      ),
    (e: unknown) => e instanceof PublishError && /no signing key/.test(e.message),
  );
  process.exitCode = 0;
});
