/**
 * S8-T09 — gateway + facilitator loadtest harness (core, dependency-free of
 * argv/process so it is unit-testable).
 *
 * Drives the real `@mcpxgg/sdk` client at a target RPS for a fixed duration
 * using an open-loop scheduler (requests are launched on a fixed tick so a
 * slow backend produces queueing latency rather than silently lowering the
 * offered load — the standard coordinated-omission-safe approach). Collects
 * per-request latency + outcome, then reports p50/p95/p99, throughput,
 * error-rate and a pass/fail verdict against thresholds.
 *
 * "dry" mode: a built-in stub fetch returns a well-formed JSON-RPC result
 * with a tiny simulated latency, so the harness can typecheck + smoke-run in
 * CI / offline with no live gateway.
 */

import { createMCPXClient, type MCPXClient } from '@mcpxgg/sdk';

export interface LoadtestConfig {
  baseUrl: string;
  apiKey: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  /** Target requests/second (open-loop offered load). */
  targetRps: number;
  durationSec: number;
  /** Pass/fail gates. */
  thresholds: {
    p95LatencyMs: number;
    maxErrorRate: number;
    /** Achieved throughput must be ≥ this fraction of targetRps. */
    minThroughputRatio: number;
  };
  /** Dry self-check: use the stub fetch, no network. */
  dry: boolean;
  /** Simulated per-request latency (ms) for dry mode. Default 5. */
  dryLatencyMs?: number;
  /** Injected client (tests). Overrides dry/real construction. */
  client?: MCPXClient;
  log?: (line: string) => void;
}

interface Sample {
  latencyMs: number;
  ok: boolean;
  errorCode?: string;
}

export interface LoadtestReport {
  totalRequests: number;
  succeeded: number;
  failed: number;
  errorRate: number;
  durationSec: number;
  achievedRps: number;
  latency: { p50: number; p95: number; p99: number; max: number };
  errorsByCode: Record<string, number>;
  pass: boolean;
  failures: string[];
}

function percentile(sortedMs: number[], p: number): number {
  if (sortedMs.length === 0) return 0;
  const idx = Math.min(
    sortedMs.length - 1,
    Math.ceil((p / 100) * sortedMs.length) - 1,
  );
  return sortedMs[Math.max(0, idx)]!;
}

/** Stub fetch: well-formed JSON-RPC settled receipt after a small delay. */
export function makeDryFetch(latencyMs: number): typeof fetch {
  return (async () => {
    if (latencyMs > 0) await new Promise((r) => setTimeout(r, latencyMs));
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [{ type: 'text', text: 'ok' }],
          isError: false,
          _meta: {
            receipt: {
              settlement: 'settled',
              tx_digest: '0xdry',
              blob_id: 'dryblob',
              amount_atomic: '1000',
              chain: 'sui',
            },
          },
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }) as unknown as typeof fetch;
}

export async function runLoadtest(
  cfg: LoadtestConfig,
): Promise<LoadtestReport> {
  const log = cfg.log ?? ((l) => console.log(l));
  const client =
    cfg.client ??
    createMCPXClient({
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl,
      ...(cfg.dry
        ? { fetchImpl: makeDryFetch(cfg.dryLatencyMs ?? 5) }
        : {}),
    });

  const totalPlanned = Math.max(
    1,
    Math.round(cfg.targetRps * cfg.durationSec),
  );
  const intervalMs = 1000 / cfg.targetRps;
  const samples: Sample[] = [];

  log(
    `loadtest: ${cfg.dry ? '[DRY] ' : ''}target=${cfg.targetRps} rps ` +
      `for ${cfg.durationSec}s (${totalPlanned} requests) → ${cfg.baseUrl}`,
  );

  const started = Date.now();
  const inflight: Promise<void>[] = [];

  for (let i = 0; i < totalPlanned; i++) {
    const dueAt = started + i * intervalMs;
    const wait = dueAt - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    const t0 = Date.now();
    inflight.push(
      client
        .callTool(cfg.toolName, cfg.toolArgs)
        .then(() => {
          samples.push({ latencyMs: Date.now() - t0, ok: true });
        })
        .catch((e: unknown) => {
          const code =
            e && typeof e === 'object' && 'code' in e
              ? String((e as { code: unknown }).code)
              : 'unknown';
          samples.push({
            latencyMs: Date.now() - t0,
            ok: false,
            errorCode: code,
          });
        }),
    );
  }

  await Promise.all(inflight);

  const wallSec = (Date.now() - started) / 1000;
  const sortedMs = samples.map((s) => s.latencyMs).sort((a, b) => a - b);
  const succeeded = samples.filter((s) => s.ok).length;
  const failed = samples.length - succeeded;
  const errorRate = samples.length ? failed / samples.length : 0;
  const achievedRps = wallSec > 0 ? samples.length / wallSec : 0;

  const errorsByCode: Record<string, number> = {};
  for (const s of samples) {
    if (!s.ok) {
      const k = s.errorCode ?? 'unknown';
      errorsByCode[k] = (errorsByCode[k] ?? 0) + 1;
    }
  }

  const latency = {
    p50: percentile(sortedMs, 50),
    p95: percentile(sortedMs, 95),
    p99: percentile(sortedMs, 99),
    max: sortedMs.length ? sortedMs[sortedMs.length - 1]! : 0,
  };

  const failures: string[] = [];
  if (latency.p95 > cfg.thresholds.p95LatencyMs) {
    failures.push(
      `p95 ${latency.p95}ms > ${cfg.thresholds.p95LatencyMs}ms`,
    );
  }
  if (errorRate > cfg.thresholds.maxErrorRate) {
    failures.push(
      `error-rate ${(errorRate * 100).toFixed(2)}% > ` +
        `${(cfg.thresholds.maxErrorRate * 100).toFixed(2)}%`,
    );
  }
  if (achievedRps < cfg.targetRps * cfg.thresholds.minThroughputRatio) {
    failures.push(
      `throughput ${achievedRps.toFixed(1)} rps < ` +
        `${(cfg.targetRps * cfg.thresholds.minThroughputRatio).toFixed(1)} rps`,
    );
  }

  const report: LoadtestReport = {
    totalRequests: samples.length,
    succeeded,
    failed,
    errorRate,
    durationSec: wallSec,
    achievedRps,
    latency,
    errorsByCode,
    pass: failures.length === 0,
    failures,
  };

  log(
    `\n── loadtest report ──\n` +
      `requests=${report.totalRequests} ok=${succeeded} fail=${failed} ` +
      `errRate=${(errorRate * 100).toFixed(2)}%\n` +
      `throughput=${achievedRps.toFixed(1)} rps over ${wallSec.toFixed(1)}s\n` +
      `latency p50=${latency.p50}ms p95=${latency.p95}ms ` +
      `p99=${latency.p99}ms max=${latency.max}ms\n` +
      (Object.keys(errorsByCode).length
        ? `errors: ${JSON.stringify(errorsByCode)}\n`
        : '') +
      `verdict: ${report.pass ? 'PASS' : 'FAIL'}` +
      (report.pass ? '' : ` (${failures.join('; ')})`),
  );

  return report;
}
