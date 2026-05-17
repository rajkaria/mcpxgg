/**
 * CDN bundle build (S7-T23).
 *
 * `tsc` (run first by the package `build` script) emits the npm-consumable
 * ESM + .d.ts into dist/. This step additionally produces two single-file,
 * dependency-inlined bundles for `<script>`-tag / CDN use:
 *
 *   dist/mcpx-widget.js      — IIFE, classic <script src>, auto-registers.
 *   dist/mcpx-widget.esm.js  — ESM, <script type="module">, auto-registers.
 *
 * @mcpxgg/sdk (workspace dep) is bundled in so the file is fully standalone.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const entry = join(root, 'src/index.ts');
const outdir = join(root, 'dist');

const common = {
  entryPoints: [entry],
  bundle: true,
  minify: true,
  sourcemap: true,
  target: ['es2022'],
  platform: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' },
};

await build({
  ...common,
  format: 'iife',
  globalName: 'McpxWidget',
  outfile: join(outdir, 'mcpx-widget.js'),
});

await build({
  ...common,
  format: 'esm',
  outfile: join(outdir, 'mcpx-widget.esm.js'),
});

console.log('[widget] CDN bundles written: dist/mcpx-widget.js, dist/mcpx-widget.esm.js');
