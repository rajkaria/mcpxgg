import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { createInMemoryStorage } from './storage/in-memory.js';
import { RecordingPubsub } from './pubsub/pubsub.js';
import { InMemoryEventSource } from './event-source/in-memory.js';
import { maybeRunAbuseScan, tick } from './runner.js';
import { NOOP_LOGGER } from './logger.js';
import { WINDOW_MS } from './abuse.js';
import type { IndexedEvent } from './types.js';

function ev(eventType: IndexedEvent['eventType'], parsedJson: Record<string, unknown>, txDigest: string, eventSeq: number, checkpoint = 100): IndexedEvent {
  return {
    txDigest,
    eventSeq,
    checkpoint,
    timestampMs: 1_700_000_000_000,
    eventType,
    parsedJson,
  };
}

describe('runner.tick', () => {
  it('processes events and advances the checkpoint', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    const source = new InMemoryEventSource([
      ev('ServerPublished', {
        server_id: '0xs1',
        namespace: 's1',
        owner: '0xo',
        metadata_blob_id: 'b',
        category: 'c',
        timestamp_ms: 0,
      }, '0xtx1', 0, 100),
      ev('ServerPublished', {
        server_id: '0xs2',
        namespace: 's2',
        owner: '0xo',
        metadata_blob_id: 'b',
        category: 'c',
        timestamp_ms: 0,
      }, '0xtx2', 0, 101),
    ]);
    const r = await tick({ storage, pubsub, source, pageSize: 50, logger: NOOP_LOGGER });
    assert.equal(r.processed, 2);
    const cp = await storage.getCheckpoint();
    assert.equal(cp.lastProcessedCheckpoint, 101);
    assert.equal(cp.lastTxDigest, '0xtx2');
  });

  it('resumes from the persisted checkpoint on the next tick', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    const source = new InMemoryEventSource();
    source.push(
      ev('ServerPublished', {
        server_id: '0xs1', namespace: 's1', owner: '0xo', metadata_blob_id: 'b', category: 'c', timestamp_ms: 0,
      }, '0xtx1', 0, 100),
      ev('ServerPublished', {
        server_id: '0xs2', namespace: 's2', owner: '0xo', metadata_blob_id: 'b', category: 'c', timestamp_ms: 0,
      }, '0xtx2', 0, 101),
    );
    await tick({ storage, pubsub, source, pageSize: 50, logger: NOOP_LOGGER });

    // Add more after the previous batch was processed.
    source.push(
      ev('ServerPublished', {
        server_id: '0xs3', namespace: 's3', owner: '0xo', metadata_blob_id: 'b', category: 'c', timestamp_ms: 0,
      }, '0xtx3', 0, 102),
    );
    const r2 = await tick({ storage, pubsub, source, pageSize: 50, logger: NOOP_LOGGER });
    assert.equal(r2.processed, 1);
    assert.equal(storage.state.servers.size, 3);
  });

  it('handles an empty source (no-op tick)', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    const source = new InMemoryEventSource();
    const r = await tick({ storage, pubsub, source, pageSize: 50, logger: NOOP_LOGGER });
    assert.equal(r.processed, 0);
    assert.equal(r.hasMore, false);
  });

  it('throws when a handler errors and preserves the checkpoint', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    const source = new InMemoryEventSource([
      // bad event: invalid bigint
      ev(
        'CallSettled',
        {
          receipt_id: '0xr',
          server_id: '0xs',
          payer: '0xp',
          tool_name: 't',
          amount_atomic: 'not-a-number',
          dev_share_atomic: '1',
          treasury_share_atomic: '1',
          insurance_share_atomic: '1',
          log_blob_id: 'b',
          success: true,
          timestamp_ms: 0,
        },
        '0xtxbad',
        0,
        200,
      ),
    ]);
    await assert.rejects(tick({ storage, pubsub, source, pageSize: 50, logger: NOOP_LOGGER }));
    const cp = await storage.getCheckpoint();
    assert.equal(cp.lastProcessedCheckpoint, 0);
  });

  it('runs the abuse scan once per closed window', async () => {
    const storage = createInMemoryStorage();
    // 12 accounts: 11 quiet, 1 whale — seed request_log via CallSettled.
    const pubsub = new RecordingPubsub();
    const win = 5 * WINDOW_MS;
    const now = win + WINDOW_MS + 1; // priorClosedWindow → [win, win+WINDOW_MS)
    const tsInWindow = win + 1000;
    const events: IndexedEvent[] = [];
    let seq = 0;
    // 50 quiet accounts: 1 call each.
    for (let i = 0; i < 50; i++) {
      events.push(
        ev(
          'CallSettled',
          {
            receipt_id: `0xr${i}`, server_id: '0xs', payer: `0xq${i}`, tool_name: 't',
            amount_atomic: '1000', dev_share_atomic: '900',
            treasury_share_atomic: '80', insurance_share_atomic: '20',
            log_blob_id: 'b', success: true, timestamp_ms: tsInWindow,
          },
          `0xt${seq}`,
          0,
          100 + seq++,
        ),
      );
    }
    // 1 whale: 60 calls — far beyond mean + 3σ of the population.
    for (let j = 0; j < 60; j++) {
      events.push(
        ev(
          'CallSettled',
          {
            receipt_id: `0xrw${j}`, server_id: '0xs', payer: '0xwhale', tool_name: 't',
            amount_atomic: '1000', dev_share_atomic: '900',
            treasury_share_atomic: '80', insurance_share_atomic: '20',
            log_blob_id: 'b', success: true, timestamp_ms: tsInWindow,
          },
          `0xtw${seq}`,
          0,
          100 + seq++,
        ),
      );
    }
    const source = new InMemoryEventSource(events);
    // Drain fully (events > one page) before scanning.
    let more = true;
    while (more) {
      more = (await tick({ storage, pubsub, source, pageSize: 200, logger: NOOP_LOGGER })).hasMore;
    }

    const first = await maybeRunAbuseScan(storage, 0, now, NOOP_LOGGER);
    assert.ok(first);
    assert.equal(first?.scannedBoundaryMs, win + WINDOW_MS);
    // The whale (60 calls @ 60× the population spend) trips both metrics.
    const flagged = storage.state.abuseFlags;
    assert.ok(flagged.length >= 1);
    assert.ok(flagged.every((f) => f.accountAddress === '0xwhale'));
    assert.ok(flagged.some((f) => f.metric === 'call_volume'));
    const flagCount = flagged.length;

    // Same window again → no-op (idempotent on the boundary).
    const second = await maybeRunAbuseScan(storage, first.scannedBoundaryMs, now, NOOP_LOGGER);
    assert.equal(second, null);
    assert.equal(storage.state.abuseFlags.length, flagCount);
  });

  it('survives a duplicate batch (rerun)', async () => {
    const storage = createInMemoryStorage();
    const pubsub = new RecordingPubsub();
    const events = [
      ev('CallSettled', {
        receipt_id: '0xr1', server_id: '0xs', payer: '0xp', tool_name: 'q',
        amount_atomic: '1000000', dev_share_atomic: '975000',
        treasury_share_atomic: '20000', insurance_share_atomic: '5000',
        log_blob_id: 'b', success: true, timestamp_ms: 0,
      }, '0xtx1', 0, 100),
    ];
    const source1 = new InMemoryEventSource(events);
    await tick({ storage, pubsub, source: source1, pageSize: 50, logger: NOOP_LOGGER });

    // Simulate a crash mid-batch followed by a restart: storage retained
    // the dedup set; the source serves the same events again.
    const source2 = new InMemoryEventSource(events);
    await tick({ storage, pubsub, source: source2, pageSize: 50, logger: NOOP_LOGGER });

    assert.equal(storage.state.requestLog.length, 1, 'no duplicate request_log row');
  });
});
