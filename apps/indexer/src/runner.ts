/**
 * Indexer runner — drains the event source, dispatches each event, and
 * persists checkpoint progress.
 *
 * Pure-function `tick` for tests; the `run` loop wraps it with sleep + a
 * stop signal. Backpressure: each tick handles at most `pageSize` events,
 * then yields. The runner never blocks the event loop with a synchronous
 * burst.
 *
 * Replay-safe: cursor (txDigest, eventSeq) is persisted to storage after
 * each batch. Restart resumes exactly where we left off; dedup in
 * `dispatch` makes a duplicate batch a no-op.
 */

import type { Storage } from './storage/storage.js';
import type { Pubsub } from './pubsub/pubsub.js';
import type { EventSource } from './event-source/source.js';
import type { Cursor } from './types.js';
import { dispatch } from './handlers/dispatch.js';
import type { Logger } from './logger.js';

export interface RunnerOptions {
  storage: Storage;
  pubsub: Pubsub;
  source: EventSource;
  pageSize: number;
  pollIntervalMs: number;
  logger: Logger;
  /** AbortSignal that ends the loop. */
  signal?: AbortSignal;
}

export interface TickResult {
  processed: number;
  hasMore: boolean;
}

/** One pass through the event source. Exposed for tests. */
export async function tick(
  opts: Omit<RunnerOptions, 'pollIntervalMs' | 'signal'>,
): Promise<TickResult> {
  const { storage, pubsub, source, pageSize, logger } = opts;
  const cp = await storage.getCheckpoint();
  const cursor: Cursor | null =
    cp.lastTxDigest === null
      ? null
      : { txDigest: cp.lastTxDigest, eventSeq: cp.lastProcessedEventSeq };

  const page = await source.fetchPage(cursor, pageSize);

  for (const event of page.events) {
    try {
      await dispatch(event, { storage, pubsub });
    } catch (e) {
      logger.error(
        {
          txDigest: event.txDigest,
          eventSeq: event.eventSeq,
          eventType: event.eventType,
          err: String(e),
        },
        'event handler error — halting tick to preserve ordering',
      );
      throw e;
    }
  }

  const last = page.events[page.events.length - 1];
  if (last) {
    await storage.updateCheckpoint({
      lastProcessedCheckpoint: last.checkpoint,
      lastProcessedEventSeq: last.eventSeq,
      lastTxDigest: last.txDigest,
    });
  }
  return { processed: page.events.length, hasMore: page.hasNextPage };
}

export async function run(opts: RunnerOptions): Promise<void> {
  const { logger, signal, pollIntervalMs } = opts;
  logger.info({ pageSize: opts.pageSize, pollIntervalMs }, 'indexer: starting');
  while (signal?.aborted !== true) {
    try {
      const result = await tick(opts);
      if (result.processed > 0) {
        logger.info({ processed: result.processed, hasMore: result.hasMore }, 'indexer: drained');
      }
      if (!result.hasMore) {
        await sleep(pollIntervalMs, signal);
      }
    } catch (e) {
      logger.error({ err: String(e) }, 'indexer: tick failed; backing off');
      await sleep(Math.max(pollIntervalMs, 5_000), signal);
    }
  }
  logger.info({}, 'indexer: stopped');
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    });
  });
}
