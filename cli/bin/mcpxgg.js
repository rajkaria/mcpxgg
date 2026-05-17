#!/usr/bin/env node
/**
 * mcpxgg CLI entrypoint.
 *
 * Published packages run the compiled `dist/index.js`. In the monorepo
 * (no build step) we fall back to running the TypeScript source via tsx so
 * `pnpm --filter @mcpxgg/cli exec mcpxgg ...` works without a build.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist', 'index.js');

if (existsSync(dist)) {
  await import(dist);
} else {
  // Dev path: run the TS source through tsx, forwarding args + exit code.
  const src = join(here, '..', 'src', 'index.ts');
  const res = spawnSync(
    process.execPath,
    ['--import', 'tsx', src, ...process.argv.slice(2)],
    { stdio: 'inherit' },
  );
  process.exit(res.status ?? 1);
}
