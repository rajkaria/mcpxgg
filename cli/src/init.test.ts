import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildProgram, type CliIo } from './commander.js';
import { validateConfig } from '@mcpxgg/shared/validation/config-schema';

function captureIo(): { io: CliIo; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { log: (m) => out.push(m), error: (m) => err.push(m) }, out, err };
}

test('init: scaffolds a config that validate then passes (round-trip)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mcpxgg-init-'));
  const cap = captureIo();
  const program = buildProgram(cap.io);
  await program.parseAsync(['node', 'mcpxgg', 'init', dir]);
  assert.equal(process.exitCode, 0);

  assert.ok(existsSync(join(dir, 'mcpx.config.json')));
  assert.ok(existsSync(join(dir, 'src', 'index.ts')));
  assert.ok(existsSync(join(dir, 'README.md')));

  const cfg = JSON.parse(await readFile(join(dir, 'mcpx.config.json'), 'utf8'));
  const result = validateConfig(cfg);
  assert.equal(result.valid, true, result.errors.join('; '));

  // And the CLI's own validate command agrees.
  const cap2 = captureIo();
  const program2 = buildProgram(cap2.io);
  await program2.parseAsync(['node', 'mcpxgg', 'validate', dir]);
  assert.equal(process.exitCode, 0);
  assert.ok(cap2.out.some((l) => l.startsWith('PASS')));
  process.exitCode = 0;
});

test('init: refuses to overwrite an existing config', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mcpxgg-init-'));
  const cap = captureIo();
  const program = buildProgram(cap.io);
  await program.parseAsync(['node', 'mcpxgg', 'init', dir]);
  assert.equal(process.exitCode, 0);

  const cap2 = captureIo();
  const program2 = buildProgram(cap2.io);
  await program2.parseAsync(['node', 'mcpxgg', 'init', dir]);
  assert.equal(process.exitCode, 1);
  assert.ok(cap2.err.some((l) => l.includes('refusing to overwrite')));
  process.exitCode = 0;
});
