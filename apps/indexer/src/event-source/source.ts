/**
 * EventSource — what the runner reads from. Real impl wraps Sui RPC;
 * in-memory impl returns pre-canned events for tests.
 */

import type { Cursor, IndexedEvent } from '../types.js';

export interface EventPage {
  events: IndexedEvent[];
  /** If null, no more pages currently available — runner waits and retries. */
  nextCursor: Cursor | null;
  /** True iff `nextCursor` may immediately yield more events without waiting. */
  hasNextPage: boolean;
}

export interface EventSource {
  /** Fetch a page of mcpx events strictly *after* `cursor` (exclusive). */
  fetchPage(cursor: Cursor | null, limit: number): Promise<EventPage>;
}
