import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runMigration,
  creditsToAtomic,
  ATOMIC_PER_CREDIT,
  type LegacyUser,
  type LegacyUserReader,
  type MigrationStore,
  type ChainClient,
} from './migrate-web2-users';

function reader(users: LegacyUser[]): LegacyUserReader {
  return { listUsers: async () => users };
}

class RecordingStore implements MigrationStore {
  migrating: string[] = [];
  migrated: Array<{ id: string; session: string }> = [];
  async markMigrating(id: string) {
    this.migrating.push(id);
  }
  async markMigrated(id: string, session: string) {
    this.migrated.push({ id, session });
  }
}

class StubChain implements ChainClient {
  calls: Array<{ suiAddress: string; depositAtomic: bigint }> = [];
  async grantSession(args: { suiAddress: string; depositAtomic: bigint }) {
    this.calls.push(args);
    return {
      sessionObjectId: `0xsession_${this.calls.length}`,
      digest: `0xdigest_${this.calls.length}`,
    };
  }
}

const silent = () => {};

test('creditsToAtomic applies the ADR-008 1:1 (1 credit = 1e6 atomic)', () => {
  assert.equal(ATOMIC_PER_CREDIT, 1_000_000n);
  assert.equal(creditsToAtomic(0), 0n);
  assert.equal(creditsToAtomic(1), 1_000_000n);
  assert.equal(creditsToAtomic(42), 42_000_000n);
  assert.throws(() => creditsToAtomic(-5));
});

test('positive-balance user → session built with correct atomic amount + marked migrated', async () => {
  const users: LegacyUser[] = [
    {
      id: 'u1',
      sui_address: '0xabc',
      credit_balance: 25,
      migration_status: 'legacy',
    },
  ];
  const store = new RecordingStore();
  const chain = new StubChain();

  const { totals, results } = await runMigration(reader(users), store, chain, {
    dryRun: false,
    concurrency: 2,
    log: silent,
  });

  assert.equal(chain.calls.length, 1);
  assert.equal(chain.calls[0]!.suiAddress, '0xabc');
  assert.equal(chain.calls[0]!.depositAtomic, 25_000_000n);
  assert.deepEqual(store.migrating, ['u1']);
  assert.equal(store.migrated.length, 1);
  assert.equal(store.migrated[0]!.session, '0xsession_1');
  assert.equal(results[0]!.status, 'migrated');
  assert.equal(totals.migrated, 1);
  assert.equal(totals.totalAtomicGranted, 25_000_000n);
});

test('zero-balance user is skipped (no chain call, no status write)', async () => {
  const store = new RecordingStore();
  const chain = new StubChain();
  const { totals, results } = await runMigration(
    reader([
      {
        id: 'z1',
        sui_address: '0xabc',
        credit_balance: 0,
        migration_status: 'legacy',
      },
    ]),
    store,
    chain,
    { dryRun: false, concurrency: 1, log: silent },
  );
  assert.equal(chain.calls.length, 0);
  assert.equal(store.migrating.length, 0);
  assert.equal(store.migrated.length, 0);
  assert.equal(results[0]!.status, 'skipped_zero');
  assert.equal(totals.skippedZero, 1);
});

test('already-migrated user is skipped (idempotent re-run)', async () => {
  const store = new RecordingStore();
  const chain = new StubChain();
  const { totals, results } = await runMigration(
    reader([
      {
        id: 'm1',
        sui_address: '0xabc',
        credit_balance: 99,
        migration_status: 'migrated',
      },
    ]),
    store,
    chain,
    { dryRun: false, concurrency: 1, log: silent },
  );
  assert.equal(chain.calls.length, 0);
  assert.equal(store.migrated.length, 0);
  assert.equal(results[0]!.status, 'skipped_done');
  assert.equal(totals.skippedDone, 1);
});

test('--dry-run signs nothing but still computes the intended amount', async () => {
  const store = new RecordingStore();
  const chain = new StubChain();
  const { totals, results } = await runMigration(
    reader([
      {
        id: 'd1',
        sui_address: '0xabc',
        credit_balance: 10,
        migration_status: 'legacy',
      },
    ]),
    store,
    chain,
    { dryRun: true, concurrency: 1, log: silent },
  );
  assert.equal(chain.calls.length, 0);
  assert.equal(store.migrating.length, 0);
  assert.equal(store.migrated.length, 0);
  assert.equal(results[0]!.status, 'dry_run');
  assert.equal(results[0]!.depositAtomic, 10_000_000n);
  assert.equal(totals.migrated, 0);
});

test('user without a linked sui_address is skipped, not errored', async () => {
  const store = new RecordingStore();
  const chain = new StubChain();
  const { totals } = await runMigration(
    reader([
      {
        id: 'n1',
        sui_address: null,
        credit_balance: 5,
        migration_status: 'legacy',
      },
    ]),
    store,
    chain,
    { dryRun: false, concurrency: 1, log: silent },
  );
  assert.equal(chain.calls.length, 0);
  assert.equal(totals.skippedNoAddress, 1);
});

test('a failing grant is recorded as error and does not abort the batch', async () => {
  const store = new RecordingStore();
  const flaky: ChainClient = {
    async grantSession(args) {
      if (args.suiAddress === '0xbad') throw new Error('rpc boom');
      return { sessionObjectId: '0xok', digest: '0xd' };
    },
  };
  const { totals, results } = await runMigration(
    reader([
      { id: 'g', sui_address: '0xgood', credit_balance: 1, migration_status: 'legacy' },
      { id: 'b', sui_address: '0xbad', credit_balance: 1, migration_status: 'legacy' },
    ]),
    store,
    flaky,
    { dryRun: false, concurrency: 1, log: silent },
  );
  assert.equal(totals.migrated, 1);
  assert.equal(totals.errors, 1);
  assert.equal(results.find((r) => r.userId === 'b')!.status, 'error');
});
