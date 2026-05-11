/**
 * Real Sui event source. Reads `queryEvents` filtered by the mcpx events
 * module. Sui returns cursor-paginated events; we forward each page.
 *
 * Module filter: `0xPKG::events`. We accept any event struct inside that
 * module — the runner re-filters by type name.
 */

import { ALL_EVENT_TYPES } from '../types.js';
import type { Cursor, EventType, IndexedEvent } from '../types.js';
import type { EventPage, EventSource } from './source.js';
import type { IndexerEnv } from '../env.js';

const EVENT_TYPE_SET = new Set<string>(ALL_EVENT_TYPES);

export async function createSuiEventSource(env: IndexerEnv): Promise<EventSource> {
  const { SuiClient } = await import('@mysten/sui/client');
  const client = new SuiClient({ url: env.suiRpcUrl });

  return {
    async fetchPage(cursor: Cursor | null, limit: number): Promise<EventPage> {
      const res = await client.queryEvents({
        query: { MoveModule: { package: env.mcpxPackageId, module: 'events' } },
        cursor: cursor === null
          ? null
          : { txDigest: cursor.txDigest, eventSeq: cursor.eventSeq.toString() },
        limit,
        order: 'ascending',
      });
      const events: IndexedEvent[] = [];
      for (const raw of res.data) {
        const typeName = raw.type.split('::').pop() ?? '';
        if (!EVENT_TYPE_SET.has(typeName)) continue;
        events.push({
          txDigest: raw.id.txDigest,
          eventSeq: Number.parseInt(raw.id.eventSeq, 10),
          checkpoint: Number.parseInt(raw.timestampMs ?? '0', 10),
          timestampMs: Number.parseInt(raw.timestampMs ?? '0', 10),
          eventType: typeName as EventType,
          parsedJson: (raw.parsedJson ?? {}) as Record<string, unknown>,
        });
      }
      return {
        events,
        nextCursor: res.nextCursor
          ? { txDigest: res.nextCursor.txDigest, eventSeq: Number.parseInt(res.nextCursor.eventSeq, 10) }
          : cursor,
        hasNextPage: Boolean(res.hasNextPage),
      };
    },
  };
}
