/**
 * Deterministic event source for tests. Construct with a pre-canned sequence
 * of `IndexedEvent`s and the runner will drain them in order. Push more via
 * `push(...)` to simulate a live tail.
 */

import type { Cursor, IndexedEvent } from '../types.js';
import type { EventPage, EventSource } from './source.js';

export class InMemoryEventSource implements EventSource {
  private buffer: IndexedEvent[] = [];

  constructor(initial: IndexedEvent[] = []) {
    this.buffer = [...initial];
  }

  push(...events: IndexedEvent[]): void {
    this.buffer.push(...events);
  }

  /** Inspect; doesn't consume. */
  size(): number {
    return this.buffer.length;
  }

  async fetchPage(cursor: Cursor | null, limit: number): Promise<EventPage> {
    let startIdx = 0;
    if (cursor !== null) {
      startIdx = this.buffer.findIndex(
        (e) => e.txDigest === cursor.txDigest && e.eventSeq === cursor.eventSeq,
      );
      if (startIdx === -1) {
        startIdx = 0;
      } else {
        startIdx += 1;
      }
    }
    const slice = this.buffer.slice(startIdx, startIdx + limit);
    const last = slice[slice.length - 1];
    return {
      events: slice,
      nextCursor: last ? { txDigest: last.txDigest, eventSeq: last.eventSeq } : cursor,
      hasNextPage: startIdx + slice.length < this.buffer.length,
    };
  }
}
