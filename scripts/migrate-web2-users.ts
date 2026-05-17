/**
 * S8-T01 — Web2 → Sui user migration.
 *
 * Reads legacy users' `credit_balance` from the old DB and, for every user
 * with a positive balance, grants them USDsui 1:1 with their remaining
 * credits by building + submitting a `create_session` PTB with an initial
 * deposit, then records the new Session object id and flips
 * `users.migration_status` to `'migrated'`.
 *
 * ── ADR-008 conversion rule ──────────────────────────────────────────────
 * SPRINTS S8-T01 says "per ADR-008 1:1". ADR-008 itself is the bootstrap
 * subsidy ADR; the load-bearing part it pins down is the USDsui atomic
 * convention: **$1.00 USDsui == 1,000,000 atomic units (6 decimals)**.
 * Legacy `credit_balance` is an INTEGER column of whole-dollar credits
 * (see supabase/migrations/002_billing_schema.sql), 1 credit == $1.00.
 * So the 1:1 grant is:
 *
 *     depositAtomic = BigInt(credit_balance) * 1_000_000n
 *
 * No take-rate, no fee — a straight 1:1 credit→USDsui carryover.
 *
 * ── Idempotency ──────────────────────────────────────────────────────────
 * A user is skipped if `migration_status === 'migrated'`. The store flips
 * status to `'migrating'` before signing and to `'migrated'` (with the new
 * session id) only after the tx lands, so a crash mid-run leaves the user
 * in `'migrating'` and a re-run can safely retry it (still not 'migrated').
 *
 * ── Legacy source is injectable ──────────────────────────────────────────
 * The legacy reader + the migration-status store are interfaces. Built-in
 * implementations: a JSON export file, and a Supabase PostgREST endpoint
 * (plain fetch — no new dependency). Tests inject in-memory fakes + a stub
 * chain client, so no real legacy DB or RPC is needed.
 *
 * Usage:
 *   tsx scripts/migrate-web2-users.ts --dry-run
 *   tsx scripts/migrate-web2-users.ts --source=json --file=./legacy.json
 *   tsx scripts/migrate-web2-users.ts --source=supabase --concurrency=4
 *
 * Env (supabase source/store):
 *   LEGACY_SUPABASE_URL, LEGACY_SUPABASE_SERVICE_KEY
 * Env (chain):
 *   MIGRATOR_PRIVATE_KEY  signer secret (suiprivkey1... or 0x-hex)
 *   MCPX_PACKAGE_ID, USDSUI_COIN_TYPE, MCPX_SESSION_REGISTRY_ID, SUI_RPC_URL
 */

import { readFile } from 'node:fs/promises';
import {
  buildCreateSessionAndDepositTx,
  signAndExecuteBase64Tx,
  type SuiTxConfig,
} from '@mcpxgg/chain';

/** $1.00 USDsui == 1e6 atomic units (ADR-008, 6 decimals). 1 credit == $1. */
export const ATOMIC_PER_CREDIT = 1_000_000n;

/** 1:1 rule: whole-dollar legacy credits → USDsui atomic units. */
export function creditsToAtomic(creditBalance: number): bigint {
  if (!Number.isFinite(creditBalance) || creditBalance < 0) {
    throw new Error(`invalid credit_balance: ${creditBalance}`);
  }
  // credit_balance is an INTEGER column; floor defensively.
  return BigInt(Math.floor(creditBalance)) * ATOMIC_PER_CREDIT;
}

export type MigrationStatus = 'legacy' | 'migrating' | 'migrated';

export interface LegacyUser {
  id: string;
  /** Destination Sui address (Privy-derived). Required to grant a session. */
  sui_address: string | null;
  credit_balance: number;
  migration_status: MigrationStatus;
}

/** Injectable read side: where legacy users come from. */
export interface LegacyUserReader {
  listUsers(): Promise<LegacyUser[]>;
}

/** Injectable write side: where migration status is persisted. */
export interface MigrationStore {
  markMigrating(userId: string): Promise<void>;
  markMigrated(userId: string, sessionObjectId: string): Promise<void>;
}

/** Injectable chain side: build+submit, returns the new session object id. */
export interface ChainClient {
  grantSession(args: {
    suiAddress: string;
    depositAtomic: bigint;
  }): Promise<{ sessionObjectId: string; digest: string }>;
}

export interface MigrationOptions {
  dryRun: boolean;
  concurrency: number;
  /** Injected sink for log lines (defaults to console.log). */
  log?: (line: string) => void;
}

export interface UserResult {
  userId: string;
  status: 'migrated' | 'skipped_zero' | 'skipped_done' | 'skipped_no_address' | 'dry_run' | 'error';
  depositAtomic?: bigint;
  sessionObjectId?: string;
  digest?: string;
  error?: string;
}

export interface MigrationSummary {
  results: UserResult[];
  totals: {
    considered: number;
    migrated: number;
    skippedZero: number;
    skippedDone: number;
    skippedNoAddress: number;
    errors: number;
    totalAtomicGranted: bigint;
  };
}

/** Bounded-concurrency map preserving input order in the result array. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = new Array(Math.max(1, Math.min(limit, items.length || 1)))
    .fill(0)
    .map(async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await fn(items[i]!, i);
      }
    });
  await Promise.all(workers);
  return results;
}

/**
 * Core migration. Pure of process/argv/env — everything is injected, so the
 * unit test drives it with in-memory fakes.
 */
export async function runMigration(
  reader: LegacyUserReader,
  store: MigrationStore,
  chain: ChainClient,
  opts: MigrationOptions,
): Promise<MigrationSummary> {
  const log = opts.log ?? ((l: string) => console.log(l));
  const users = await reader.listUsers();

  const results = await mapWithConcurrency(
    users,
    opts.concurrency,
    async (u): Promise<UserResult> => {
      if (u.migration_status === 'migrated') {
        log(`[skip] ${u.id}: already migrated`);
        return { userId: u.id, status: 'skipped_done' };
      }
      if (!u.credit_balance || u.credit_balance <= 0) {
        log(`[skip] ${u.id}: zero balance`);
        return { userId: u.id, status: 'skipped_zero' };
      }
      if (!u.sui_address) {
        log(`[skip] ${u.id}: no sui_address (user has not linked a wallet)`);
        return { userId: u.id, status: 'skipped_no_address' };
      }

      const depositAtomic = creditsToAtomic(u.credit_balance);

      if (opts.dryRun) {
        log(
          `[dry-run] ${u.id}: would grant ${depositAtomic} atomic ` +
            `(${u.credit_balance} credits) → ${u.sui_address}`,
        );
        return { userId: u.id, status: 'dry_run', depositAtomic };
      }

      try {
        await store.markMigrating(u.id);
        const { sessionObjectId, digest } = await chain.grantSession({
          suiAddress: u.sui_address,
          depositAtomic,
        });
        await store.markMigrated(u.id, sessionObjectId);
        log(
          `[ok] ${u.id}: granted ${depositAtomic} atomic, session=` +
            `${sessionObjectId} digest=${digest}`,
        );
        return {
          userId: u.id,
          status: 'migrated',
          depositAtomic,
          sessionObjectId,
          digest,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`[error] ${u.id}: ${msg}`);
        return { userId: u.id, status: 'error', depositAtomic, error: msg };
      }
    },
  );

  const totals = {
    considered: users.length,
    migrated: results.filter((r) => r.status === 'migrated').length,
    skippedZero: results.filter((r) => r.status === 'skipped_zero').length,
    skippedDone: results.filter((r) => r.status === 'skipped_done').length,
    skippedNoAddress: results.filter((r) => r.status === 'skipped_no_address')
      .length,
    errors: results.filter((r) => r.status === 'error').length,
    totalAtomicGranted: results
      .filter((r) => r.status === 'migrated')
      .reduce((acc, r) => acc + (r.depositAtomic ?? 0n), 0n),
  };

  log(
    `\n── totals ──\n` +
      `considered=${totals.considered} migrated=${totals.migrated} ` +
      `skipped(zero=${totals.skippedZero} done=${totals.skippedDone} ` +
      `noaddr=${totals.skippedNoAddress}) errors=${totals.errors}\n` +
      `granted=${totals.totalAtomicGranted} atomic ` +
      `(${totals.totalAtomicGranted / ATOMIC_PER_CREDIT} USDsui)`,
  );

  return { results, totals };
}

/* ────────────────────────── built-in adapters ─────────────────────────── */

/** Reads a JSON array export: [{ id, sui_address, credit_balance, ... }]. */
export class JsonFileLegacyReader implements LegacyUserReader {
  constructor(private readonly filePath: string) {}
  async listUsers(): Promise<LegacyUser[]> {
    const raw = await readFile(this.filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error(`${this.filePath}: expected a JSON array of users`);
    }
    return parsed.map((row): LegacyUser => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        sui_address:
          typeof r.sui_address === 'string' ? r.sui_address : null,
        credit_balance: Number(r.credit_balance ?? 0),
        migration_status:
          (r.migration_status as MigrationStatus) ?? 'legacy',
      };
    });
  }
}

/** No-op store for --dry-run / JSON-only runs (nothing to persist). */
export class NoopMigrationStore implements MigrationStore {
  async markMigrating(): Promise<void> {}
  async markMigrated(): Promise<void> {}
}

/**
 * Supabase PostgREST adapter (read + status writes) using plain fetch — no
 * @supabase/supabase-js dependency added to the scripts package.
 */
export class SupabaseLegacyAdapter
  implements LegacyUserReader, MigrationStore
{
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
  ) {}

  private headers(): Record<string, string> {
    return {
      apikey: this.serviceKey,
      authorization: `Bearer ${this.serviceKey}`,
      'content-type': 'application/json',
    };
  }

  async listUsers(): Promise<LegacyUser[]> {
    const sel =
      'id,sui_address,credit_balance,migration_status' +
      '&migration_status=neq.migrated&credit_balance=gt.0';
    const res = await fetch(
      `${this.url}/rest/v1/users?select=${sel}`,
      { headers: this.headers() },
    );
    if (!res.ok) {
      throw new Error(`supabase list failed: ${res.status} ${await res.text()}`);
    }
    const rows = (await res.json()) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: String(r.id),
      sui_address: typeof r.sui_address === 'string' ? r.sui_address : null,
      credit_balance: Number(r.credit_balance ?? 0),
      migration_status: (r.migration_status as MigrationStatus) ?? 'legacy',
    }));
  }

  private async patch(
    userId: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    const res = await fetch(
      `${this.url}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`,
      { method: 'PATCH', headers: this.headers(), body: JSON.stringify(body) },
    );
    if (!res.ok) {
      throw new Error(
        `supabase patch ${userId} failed: ${res.status} ${await res.text()}`,
      );
    }
  }

  async markMigrating(userId: string): Promise<void> {
    await this.patch(userId, { migration_status: 'migrating' });
  }

  async markMigrated(userId: string, sessionObjectId: string): Promise<void> {
    await this.patch(userId, {
      migration_status: 'migrated',
      sui_session_object_id: sessionObjectId,
    });
  }
}

/** Real chain client: build create_session+deposit PTB and submit it. */
export class SuiChainClient implements ChainClient {
  constructor(
    private readonly cfg: SuiTxConfig,
    private readonly privateKey: string,
  ) {}

  async grantSession(args: {
    suiAddress: string;
    depositAtomic: bigint;
  }): Promise<{ sessionObjectId: string; digest: string }> {
    const built = await buildCreateSessionAndDepositTx({
      cfg: this.cfg,
      sender: args.suiAddress,
      initialDepositAtomic: args.depositAtomic,
    });
    const { digest, created } = await signAndExecuteBase64Tx({
      txBytesB64: built.txBytesB64,
      privateKey: this.privateKey,
      rpcUrl: this.cfg.rpcUrl,
    });
    const session = created.find((c) =>
      c.objectType.includes('::session::Session'),
    );
    if (!session) {
      throw new Error(
        `tx ${digest} created no Session object (changes: ` +
          `${created.map((c) => c.objectType).join(', ')})`,
      );
    }
    return { sessionObjectId: session.objectId, digest };
  }
}

/* ──────────────────────────── CLI entrypoint ──────────────────────────── */

function parseArgs(argv: string[]): {
  dryRun: boolean;
  source: 'json' | 'supabase';
  file: string;
  concurrency: number;
} {
  const get = (k: string, d?: string) => {
    const hit = argv.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.slice(k.length + 3) : d;
  };
  return {
    dryRun: argv.includes('--dry-run'),
    source: (get('source', 'json') as 'json' | 'supabase'),
    file: get('file', './legacy-users.json')!,
    concurrency: Number(get('concurrency', '4')),
  };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing required env ${name}`);
  return v;
}

export async function main(argv: string[]): Promise<void> {
  const args = parseArgs(argv);

  let reader: LegacyUserReader;
  let store: MigrationStore;

  if (args.source === 'supabase') {
    const adapter = new SupabaseLegacyAdapter(
      requireEnv('LEGACY_SUPABASE_URL'),
      requireEnv('LEGACY_SUPABASE_SERVICE_KEY'),
    );
    reader = adapter;
    store = adapter;
  } else {
    reader = new JsonFileLegacyReader(args.file);
    store = new NoopMigrationStore();
  }

  let chain: ChainClient;
  if (args.dryRun) {
    // Never constructs a signer in dry-run.
    chain = {
      async grantSession() {
        throw new Error('grantSession must not be called during --dry-run');
      },
    };
  } else {
    const cfg: SuiTxConfig = {
      packageId: requireEnv('MCPX_PACKAGE_ID'),
      coinType: requireEnv('USDSUI_COIN_TYPE'),
      sessionRegistryId: requireEnv('MCPX_SESSION_REGISTRY_ID'),
      rpcUrl: process.env.SUI_RPC_URL ?? 'https://fullnode.testnet.sui.io:443',
    };
    chain = new SuiChainClient(cfg, requireEnv('MIGRATOR_PRIVATE_KEY'));
  }

  await runMigration(reader, store, chain, {
    dryRun: args.dryRun,
    concurrency: args.concurrency,
  });
}

// Run only when executed directly (not when imported by the test).
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
