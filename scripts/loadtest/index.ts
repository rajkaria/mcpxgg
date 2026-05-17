/**
 * S8-T09 — loadtest CLI entrypoint.
 *
 * DRY self-check (default — CI / offline safe, no live backend):
 *   tsx scripts/loadtest/index.ts
 *
 * Against a real deployment:
 *   MCPX_API_KEY=mcpx_sk_... \
 *   tsx scripts/loadtest/index.ts \
 *     --base-url=https://gateway.mcpx.gg \
 *     --rps=100 --duration=30 --tool=walrus-store_metadata --live
 *
 * Flags:
 *   --live              hit the real backend (default: dry stub fetch)
 *   --base-url=URL      gateway base url (default https://gateway.mcpx.gg)
 *   --rps=N             target requests/sec (default 100)
 *   --duration=N        seconds (default 30; default 2 in dry mode)
 *   --tool=NAME         tool to call (default 'loadtest_ping')
 *   --p95=N             p95 latency threshold ms (default 1500)
 *   --max-error-rate=F  fraction 0..1 (default 0.01)
 *   --min-throughput=F  achieved/target ratio gate (default 0.90)
 *
 * Exits non-zero on FAIL so it can gate CI / a deploy step.
 *
 * Pointing at a real deployment:
 *   1. Deploy gateway+facilitator (fly/railway) and note the public URL.
 *   2. Create a session + mint an API key (CLI: `mcpx keys create`), export
 *      it as MCPX_API_KEY.
 *   3. Pick a cheap real tool (anchor `walrus-store_metadata` is ideal — it
 *      exercises the full execute→archive→settle path) and pass --tool.
 *   4. Run with --live; ramp --rps until a threshold trips to find the knee.
 */

import { runLoadtest, type LoadtestConfig } from './harness';

function flag(argv: string[], k: string, d?: string): string | undefined {
  const hit = argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
}

async function main(argv: string[]): Promise<void> {
  const live = argv.includes('--live');
  const dry = !live;

  const cfg: LoadtestConfig = {
    baseUrl: flag(argv, 'base-url', 'https://gateway.mcpx.gg')!,
    apiKey: process.env.MCPX_API_KEY ?? 'mcpx_sk_dry_selfcheck',
    toolName: flag(argv, 'tool', 'loadtest_ping')!,
    toolArgs: {},
    targetRps: Number(flag(argv, 'rps', '100')),
    durationSec: Number(flag(argv, 'duration', dry ? '2' : '30')),
    thresholds: {
      p95LatencyMs: Number(flag(argv, 'p95', '1500')),
      maxErrorRate: Number(flag(argv, 'max-error-rate', '0.01')),
      minThroughputRatio: Number(flag(argv, 'min-throughput', '0.90')),
    },
    dry,
  };

  if (live && !process.env.MCPX_API_KEY) {
    throw new Error('--live requires MCPX_API_KEY to be set');
  }

  const report = await runLoadtest(cfg);
  if (!report.pass) process.exitCode = 1;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { main };
