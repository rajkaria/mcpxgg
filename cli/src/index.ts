#!/usr/bin/env node
/**
 * @mcpxgg/cli entrypoint (S5-T07..T13).
 *
 * Thin wrapper: builds the Commander program and parses argv. Subcommands
 * set `process.exitCode`; an unexpected throw exits non-zero.
 */

import { buildProgram } from './commander.js';

async function main(): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  process.stderr.write(`mcpxgg: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
