import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildProgram, type CliIo } from './commander.js';

function captureIo(): { io: CliIo; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { log: (m) => out.push(m), error: (m) => err.push(m) }, out, err };
}

async function tmp(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'mcpxgg-cli-'));
}

const GOOD = {
  namespace: 'good-server',
  name: 'Good Server',
  description: 'A perfectly valid server config for testing.',
  category: 'other',
  tags: ['test'],
  triggerPhrases: ['use good server'],
  endpointUrl: 'https://good.example.com',
  tools: [
    {
      name: 'echo',
      description: 'Echoes input.',
      priceAtomic: '1000',
      freeTierCallsPerUser: 3,
      timeoutSeconds: 30,
      inputSchema: { type: 'object', properties: {} },
    },
  ],
};

async function runValidate(dir: string) {
  const cap = captureIo();
  const program = buildProgram(cap.io);
  await program.parseAsync(['node', 'mcpxgg', 'validate', dir]);
  return { ...cap, exitCode: process.exitCode };
}

test('validate: a good config passes', async () => {
  const dir = await tmp();
  await writeFile(join(dir, 'mcpx.config.json'), JSON.stringify(GOOD), 'utf8');
  const r = await runValidate(dir);
  assert.equal(r.exitCode, 0);
  assert.ok(r.out.some((l) => l.startsWith('PASS')));
  assert.ok(r.out.some((l) => l.includes('good-server')));
  process.exitCode = 0;
});

test('validate: legacy creditCost integers fail (no priceAtomic)', async () => {
  const dir = await tmp();
  const bad = {
    ...GOOD,
    tools: [
      {
        name: 'echo',
        description: 'Echoes input.',
        creditCost: 3,
        freeTierCallsPerUser: 3,
        timeoutSeconds: 30,
        inputSchema: { type: 'object' },
      },
    ],
  };
  await writeFile(join(dir, 'mcpx.config.json'), JSON.stringify(bad), 'utf8');
  const r = await runValidate(dir);
  assert.equal(r.exitCode, 1);
  assert.ok(r.err.some((l) => l.includes('priceAtomic')));
  process.exitCode = 0;
});

test('validate: missing namespace fails with a specific message', async () => {
  const dir = await tmp();
  const bad = { ...GOOD } as Record<string, unknown>;
  delete bad.namespace;
  await writeFile(join(dir, 'mcpx.config.json'), JSON.stringify(bad), 'utf8');
  const r = await runValidate(dir);
  assert.equal(r.exitCode, 1);
  assert.ok(r.err.some((l) => l.includes('namespace must be a string')));
  process.exitCode = 0;
});

test('validate: bad priceAtomic (non-integer string) fails', async () => {
  const dir = await tmp();
  const bad = {
    ...GOOD,
    tools: [{ ...GOOD.tools[0], priceAtomic: '1.5' }],
  };
  await writeFile(join(dir, 'mcpx.config.json'), JSON.stringify(bad), 'utf8');
  const r = await runValidate(dir);
  assert.equal(r.exitCode, 1);
  assert.ok(r.err.some((l) => l.includes('priceAtomic')));
  process.exitCode = 0;
});

test('validate: missing file fails cleanly', async () => {
  const dir = await tmp();
  const r = await runValidate(dir);
  assert.equal(r.exitCode, 1);
  assert.ok(r.err.some((l) => l.includes('not found')));
  process.exitCode = 0;
});
