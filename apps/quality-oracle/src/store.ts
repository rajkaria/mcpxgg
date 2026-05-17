/**
 * Supabase-backed QualityStore. Read-only: pulls call samples from the
 * chain-mirror `request_log` over a closed window. The oracle NEVER writes
 * Postgres — it submits the Move tx and the indexer mirrors the resulting
 * QualityAttested event into `quality_attestations` (ADR-011).
 *
 * Lazy-loads @supabase/supabase-js so the pure test path doesn't resolve it.
 */

import type { CallSample, QualityStore } from './oracle.js';

const PAGE = 1000;

export async function createSupabaseQualityStore(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<QualityStore> {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async getCallSamples(windowStartMs: number, windowEndMs: number): Promise<CallSample[]> {
      const startIso = new Date(windowStartMs).toISOString();
      const endIso = new Date(windowEndMs).toISOString();
      const out: CallSample[] = [];
      // Keyset over created_at would be ideal; range-paginate for simplicity
      // (a 6h window is bounded and the oracle runs infrequently).
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await sb
          .from('request_log')
          .select('server_object_id,status,latency_ms,created_at')
          .not('server_object_id', 'is', null)
          .gte('created_at', startIso)
          .lt('created_at', endIso)
          .order('created_at', { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw new Error(`getCallSamples: ${error.message}`);
        const rows = (data ?? []) as {
          server_object_id: string;
          status: string;
          latency_ms: number | null;
        }[];
        for (const r of rows) {
          out.push({
            serverObjectId: r.server_object_id,
            status: normalizeStatus(r.status),
            latencyMs: r.latency_ms ?? null,
          });
        }
        if (rows.length < PAGE) break;
      }
      return out;
    },
  };
}

function normalizeStatus(s: string): CallSample['status'] {
  return s === 'success' || s === 'error' || s === 'timeout' || s === 'refunded'
    ? s
    : 'error';
}
