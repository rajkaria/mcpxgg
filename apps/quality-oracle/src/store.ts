/**
 * Supabase-backed QualityStore. Read-only: pulls call samples from the
 * chain-mirror `request_log` over a closed window. The oracle NEVER writes
 * Postgres — it submits the Move tx and the indexer mirrors the resulting
 * QualityAttested event into `quality_attestations` (ADR-011).
 *
 * Lazy-loads @supabase/supabase-js so the pure test path doesn't resolve it.
 */

import type {
  BreachStreakStore,
  CallSample,
  QualityStore,
  StakeStore,
} from './oracle.js';
import type { StakedServer } from './sla.js';

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

// ─── S7-T09: staked-server reads (indexer `stakes`/`stake_slashes` mirror) ──

/**
 * Reads the indexer-owned `stakes` mirror (migration 007) and nets out prior
 * slashes from `stake_slashes` to get the live remaining stake. Read-only —
 * the oracle never writes the mirror; the chain owns stakes (ADR-011).
 */
export async function createSupabaseStakeStore(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<StakeStore> {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async listActiveStakes(): Promise<StakedServer[]> {
      const { data: stakeRows, error: sErr } = await sb
        .from('stakes')
        .select('stake_object_id,server_object_id,amount_atomic,sla_uptime_x100');
      if (sErr) throw new Error(`listActiveStakes(stakes): ${sErr.message}`);
      const rows = (stakeRows ?? []) as {
        stake_object_id: string;
        server_object_id: string;
        amount_atomic: number | string;
        sla_uptime_x100: number;
      }[];
      if (rows.length === 0) return [];

      const { data: slashRows, error: slErr } = await sb
        .from('stake_slashes')
        .select('stake_object_id,amount_atomic');
      if (slErr)
        throw new Error(`listActiveStakes(stake_slashes): ${slErr.message}`);
      const slashedByStake = new Map<string, bigint>();
      for (const r of (slashRows ?? []) as {
        stake_object_id: string;
        amount_atomic: number | string;
      }[]) {
        slashedByStake.set(
          r.stake_object_id,
          (slashedByStake.get(r.stake_object_id) ?? 0n) +
            BigInt(r.amount_atomic),
        );
      }

      const out: StakedServer[] = [];
      for (const r of rows) {
        const total = BigInt(r.amount_atomic);
        const slashed = slashedByStake.get(r.stake_object_id) ?? 0n;
        const remaining = total - slashed;
        // Fully-slashed stakes have nothing left to enforce against.
        if (remaining <= 0n) continue;
        out.push({
          stakeObjectId: r.stake_object_id,
          serverObjectId: r.server_object_id,
          slaUptimeX100: Number(r.sla_uptime_x100),
          remainingStakeAtomic: remaining,
        });
      }
      return out;
    },
  };
}

/**
 * Oracle-owned breach-streak persistence (migration 014). Sole writer is this
 * service; survives restarts so the ≥2-consecutive-window rule holds.
 */
export async function createSupabaseBreachStreakStore(
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<BreachStreakStore> {
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async getStreak(stakeObjectId: string): Promise<number> {
      const { data, error } = await sb
        .from('oracle_breach_streaks')
        .select('consecutive_breaches')
        .eq('stake_object_id', stakeObjectId)
        .maybeSingle();
      if (error) throw new Error(`getStreak: ${error.message}`);
      return data ? Number((data as { consecutive_breaches: number }).consecutive_breaches) : 0;
    },
    async setStreak(
      stakeObjectId: string,
      consecutiveBreaches: number,
    ): Promise<void> {
      const { error } = await sb.from('oracle_breach_streaks').upsert(
        {
          stake_object_id: stakeObjectId,
          consecutive_breaches: consecutiveBreaches,
          last_window_end_ms: Date.now(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'stake_object_id' },
      );
      if (error) throw new Error(`setStreak: ${error.message}`);
    },
  };
}
