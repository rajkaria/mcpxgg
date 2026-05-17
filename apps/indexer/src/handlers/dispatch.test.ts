import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { createInMemoryStorage } from '../storage/in-memory.js';
import { RecordingPubsub } from '../pubsub/pubsub.js';
import { dispatch } from './dispatch.js';
import type { IndexedEvent } from '../types.js';

function makeEvent<T extends IndexedEvent['eventType']>(eventType: T, parsedJson: Record<string, unknown>, overrides: Partial<IndexedEvent> = {}): IndexedEvent {
  return {
    txDigest: '0xtx1',
    eventSeq: 0,
    checkpoint: 100,
    timestampMs: 1_700_000_000_000,
    eventType,
    parsedJson,
    ...overrides,
  };
}

describe('dispatch — registry events', () => {
  it('upserts on ServerPublished', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    await dispatch(
      makeEvent('ServerPublished', {
        server_id: '0xsrv',
        namespace: 'walrus-search',
        owner: '0xowner',
        metadata_blob_id: 'walrus-blob',
        category: 'search',
        timestamp_ms: 1_700_000_000_000,
      }),
      { storage, pubsub },
    );
    const server = storage.state.servers.get('0xsrv');
    assert.equal(server?.namespace, 'walrus-search');
    assert.equal(pubsub.published.length, 1);
    assert.equal(pubsub.published[0]?.payload.eventType, 'ServerPublished');
  });

  it('decodes vector<u8> namespace as UTF-8 byte arrays', async () => {
    const storage = createInMemoryStorage();
    const bytes = [0x68, 0x65, 0x6c, 0x6c, 0x6f]; // "hello"
    await dispatch(
      makeEvent('ServerPublished', {
        server_id: '0xsrv',
        namespace: bytes,
        owner: '0xowner',
        metadata_blob_id: 'walrus-blob',
        category: 'search',
        timestamp_ms: 0,
      }),
      { storage, pubsub: new RecordingPubsub() },
    );
    assert.equal(storage.state.servers.get('0xsrv')?.namespace, 'hello');
  });

  it('bumps version on ServerUpdated', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    await dispatch(
      makeEvent('ServerPublished', {
        server_id: '0xsrv',
        namespace: 'srv',
        owner: '0xo',
        metadata_blob_id: 'b',
        category: 'c',
        timestamp_ms: 0,
      }),
      { storage, pubsub },
    );
    await dispatch(
      makeEvent('ServerUpdated', { server_id: '0xsrv', version: 5, timestamp_ms: 0 }, { eventSeq: 1 }),
      { storage, pubsub },
    );
    assert.equal(storage.state.servers.get('0xsrv')?.version, 5);
  });

  it('deactivates on ServerDeactivated', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    await dispatch(
      makeEvent('ServerPublished', {
        server_id: '0xsrv',
        namespace: 'srv',
        owner: '0xo',
        metadata_blob_id: 'b',
        category: 'c',
        timestamp_ms: 0,
      }),
      { storage, pubsub },
    );
    await dispatch(
      makeEvent('ServerDeactivated', { server_id: '0xsrv', timestamp_ms: 0 }, { eventSeq: 1 }),
      { storage, pubsub },
    );
    assert.equal(storage.state.servers.get('0xsrv')?.active, false);
  });

  it('adds and removes tools', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    await dispatch(
      makeEvent('ToolAdded', { server_id: '0xsrv', tool_name: 'query', price_atomic: '1500000' }),
      { storage, pubsub },
    );
    assert.equal(storage.state.tools.get('0xsrv::query')?.priceAtomic, 1_500_000n);
    await dispatch(
      makeEvent('ToolRemoved', { server_id: '0xsrv', tool_name: 'query' }, { eventSeq: 1 }),
      { storage, pubsub },
    );
    assert.equal(storage.state.tools.has('0xsrv::query'), false);
  });
});

describe('dispatch — session events', () => {
  it('creates and deposits on a session', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    await dispatch(
      makeEvent('SessionCreated', {
        session_id: '0xsess',
        owner: '0xo',
        initial_balance_atomic: '5000000',
        timestamp_ms: 0,
      }),
      { storage, pubsub },
    );
    await dispatch(
      makeEvent(
        'SessionDeposit',
        { session_id: '0xsess', amount_atomic: '1000000', new_balance_atomic: '6000000' },
        { eventSeq: 1 },
      ),
      { storage, pubsub },
    );
    const s = storage.state.sessions.get('0xsess');
    assert.equal(s?.balanceAtomic, 6_000_000n);
    assert.equal(s?.lifetimeDepositedAtomic, 6_000_000n);
  });

  it('applies withdraw and limits', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    await dispatch(
      makeEvent('SessionCreated', {
        session_id: '0xsess',
        owner: '0xo',
        initial_balance_atomic: '5000000',
        timestamp_ms: 0,
      }),
      { storage, pubsub },
    );
    await dispatch(
      makeEvent(
        'SessionWithdraw',
        { session_id: '0xsess', amount_atomic: '500000', new_balance_atomic: '4500000' },
        { eventSeq: 1 },
      ),
      { storage, pubsub },
    );
    await dispatch(
      makeEvent(
        'SessionLimitsUpdated',
        { session_id: '0xsess', per_call_cap_atomic: '2000000', per_day_cap_atomic: '8000000' },
        { eventSeq: 2 },
      ),
      { storage, pubsub },
    );
    const s = storage.state.sessions.get('0xsess');
    assert.equal(s?.balanceAtomic, 4_500_000n);
    assert.equal(s?.perCallCapAtomic, 2_000_000n);
  });

  it('closes a session', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    await dispatch(
      makeEvent('SessionCreated', {
        session_id: '0xsess',
        owner: '0xo',
        initial_balance_atomic: '5000000',
        timestamp_ms: 0,
      }),
      { storage, pubsub },
    );
    await dispatch(
      makeEvent('SessionClosed', { session_id: '0xsess', refund_atomic: '500000' }, { eventSeq: 1 }),
      { storage, pubsub },
    );
    assert.equal(storage.state.sessions.get('0xsess')?.active, false);
  });
});

describe('dispatch — settlement events', () => {
  it('inserts a request_log row on CallSettled', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    await dispatch(
      makeEvent('CallSettled', {
        receipt_id: '0xrcpt',
        server_id: '0xsrv',
        payer: '0xpayer',
        tool_name: 'query',
        amount_atomic: '1000000',
        dev_share_atomic: '975000',
        treasury_share_atomic: '20000',
        insurance_share_atomic: '5000',
        log_blob_id: 'walrus-blob',
        success: true,
        timestamp_ms: 1_700_000_000_000,
      }),
      { storage, pubsub },
    );
    assert.equal(storage.state.requestLog.length, 1);
    const row = storage.state.requestLog[0];
    assert.equal(row?.amountAtomic, 1_000_000n);
    assert.equal(row?.devShareAtomic, 975_000n);
    assert.equal(row?.success, true);
    // CallSettled is in the live pubsub set.
    assert.equal(pubsub.published.length, 1);
  });

  it('records refunds', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    await dispatch(
      makeEvent('RefundIssued', {
        original_receipt_id: '0xrcpt',
        refund_amount_atomic: '500000',
        timestamp_ms: 0,
      }),
      { storage, pubsub },
    );
    assert.equal(storage.state.refunds.length, 1);
    assert.equal(storage.state.refunds[0]?.amountAtomic, 500_000n);
  });
});

describe('dispatch — vault, treasury, insurance', () => {
  it('tracks vault create, accrue, claim', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    await dispatch(
      makeEvent('VaultCreated', { vault_id: '0xv', owner: '0xowner' }),
      { storage, pubsub },
    );
    await dispatch(
      makeEvent(
        'VaultAccrued',
        {
          vault_id: '0xv',
          amount_atomic: '975000',
          new_balance_atomic: '975000',
          lifetime_earnings_atomic: '975000',
        },
        { eventSeq: 1 },
      ),
      { storage, pubsub },
    );
    await dispatch(
      makeEvent(
        'VaultClaimed',
        { vault_id: '0xv', owner: '0xowner', amount_atomic: '975000', timestamp_ms: 0 },
        { eventSeq: 2 },
      ),
      { storage, pubsub },
    );
    const v = storage.state.vaults.get('0xv');
    assert.equal(v?.accruedBalanceAtomic, 0n);
    assert.equal(v?.lifetimeClaimedAtomic, 975_000n);
    assert.ok(pubsub.published.some((p) => p.payload.eventType === 'VaultClaimed'));
  });

  it('accumulates treasury and insurance balances', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    await dispatch(
      makeEvent('TreasuryCollected', { amount_atomic: '20000', lifetime_collected_atomic: '20000' }),
      { storage, pubsub },
    );
    await dispatch(
      makeEvent(
        'InsuranceCollected',
        { amount_atomic: '5000', lifetime_collected_atomic: '5000' },
        { eventSeq: 1 },
      ),
      { storage, pubsub },
    );
    await dispatch(
      makeEvent(
        'InsurancePaid',
        { amount_atomic: '1000', recipient: '0xuser', reason: 'downtime', timestamp_ms: 0 },
        { eventSeq: 2 },
      ),
      { storage, pubsub },
    );
    assert.equal(storage.state.platform.treasury_balance_atomic, 20_000n);
    assert.equal(storage.state.platform.insurance_balance_atomic, 4_000n);
    assert.equal(storage.state.platform.insurance_paid_atomic, 1_000n);
    assert.equal(storage.state.platform.insurance_lifetime_atomic, 5_000n);
    assert.ok(pubsub.published.some((p) => p.payload.eventType === 'InsurancePaid'));
  });
});

describe('dispatch — admin, quality, stubs', () => {
  it('applies ConfigUpdated and ConfigPaused', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    await dispatch(
      makeEvent('ConfigUpdated', { take_rate_bps: 300, insurance_bps: 75, subsidy_atomic: '2000000' }),
      { storage, pubsub },
    );
    await dispatch(
      makeEvent('ConfigPaused', { paused: true, timestamp_ms: 0 }, { eventSeq: 1 }),
      { storage, pubsub },
    );
    assert.equal(storage.state.platform.takeRateBps, 300);
    assert.equal(storage.state.platform.paused, true);
  });

  it('records QualityAttested', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    await dispatch(
      makeEvent('QualityAttested', {
        attestation_id: '0xq',
        server_id: '0xsrv',
        score_x100: 9850,
        uptime_x100: 9990,
        p95_latency_ms: 220,
        error_rate_x100: 5,
        sample_count: 1000,
        timestamp_ms: 0,
      }),
      { storage, pubsub },
    );
    assert.equal(storage.state.qualities.length, 1);
    assert.equal(storage.state.qualities[0]?.scoreX100, 9850);
  });

  it('records intent lifecycle', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    await dispatch(
      makeEvent('IntentCreated', {
        intent_id: '0xi',
        user: '0xuser',
        agent: '0xagent',
        daily_cap_atomic: '5000000',
        per_call_cap_atomic: '250000',
        expires_at_ms: 0,
      }),
      { storage, pubsub },
    );
    await dispatch(
      makeEvent(
        'IntentUsed',
        { intent_id: '0xi', receipt_id: '0xrcpt', amount_atomic: '1000000' },
        { eventSeq: 1 },
      ),
      { storage, pubsub },
    );
    await dispatch(
      makeEvent('IntentRevoked', { intent_id: '0xi', timestamp_ms: 0 }, { eventSeq: 2 }),
      { storage, pubsub },
    );
    const intent = storage.state.intents.get('0xi');
    assert.equal(intent?.revoked, true);
    assert.equal(intent?.usages.length, 1);
    assert.equal(intent?.perCallCapAtomic, 250_000n);
  });

  it('records stake and slash', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    await dispatch(
      makeEvent('StakePosted', {
        stake_id: '0xst',
        server_id: '0xsrv',
        owner: '0xowner',
        amount_atomic: '10000000',
        sla_uptime_x100: 9990,
      }),
      { storage, pubsub },
    );
    await dispatch(
      makeEvent(
        'StakeSlashed',
        {
          stake_id: '0xst',
          server_id: '0xsrv',
          amount_atomic: '500000',
          reason: 'downtime > sla',
          timestamp_ms: 0,
        },
        { eventSeq: 1 },
      ),
      { storage, pubsub },
    );
    const st = storage.state.stakes.get('0xst');
    assert.equal(st?.slashes.length, 1);
    assert.equal(st?.slashes[0]?.reason, 'downtime > sla');
  });

  it('records bundle lifecycle', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    await dispatch(
      makeEvent('BundleCreated', {
        bundle_id: '0xb',
        creator: '0xc',
        server_count: 3,
        price_multiplier_x100: 90,
      }),
      { storage, pubsub },
    );
    await dispatch(
      makeEvent(
        'BundleActivated',
        { bundle_id: '0xb', user: '0xu', timestamp_ms: 0 },
        { eventSeq: 1 },
      ),
      { storage, pubsub },
    );
    const b = storage.state.bundles.get('0xb');
    assert.equal(b?.activations.length, 1);
    assert.ok(pubsub.published.some((p) => p.payload.eventType === 'BundleActivated'));
  });

  it('records a review', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    await dispatch(
      makeEvent('ReviewPosted', {
        review_id: '0xrev',
        server_id: '0xsrv',
        reviewer: '0xreviewer',
        rating_x10: 45,
      }),
      { storage, pubsub },
    );
    assert.equal(storage.state.reviews.length, 1);
    assert.equal(storage.state.reviews[0]?.ratingX10, 45);
  });
});

describe('dispatch — dedup', () => {
  it('drops a duplicate (txDigest, eventSeq)', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    const e = makeEvent('ServerPublished', {
      server_id: '0xsrv',
      namespace: 'srv',
      owner: '0xo',
      metadata_blob_id: 'b',
      category: 'c',
      timestamp_ms: 0,
    });
    await dispatch(e, { storage, pubsub });
    await dispatch(e, { storage, pubsub });
    assert.equal(storage.state.servers.size, 1);
    assert.equal(pubsub.published.length, 1);
  });
});
