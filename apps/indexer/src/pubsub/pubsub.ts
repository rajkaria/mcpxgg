/**
 * Pubsub interface. The indexer publishes selected event types after a
 * successful write so the `/live` page can render real-time activity. Real
 * impl uses Upstash Redis; no-op impl drops messages on the floor (tests +
 * dev with no Redis configured).
 */

import type { IndexedEvent } from '../types.js';

export interface Pubsub {
  publish(channel: string, payload: PubsubPayload): Promise<void>;
}

export interface PubsubPayload {
  eventType: IndexedEvent['eventType'];
  txDigest: string;
  timestampMs: number;
  data: Record<string, unknown>;
}

export const NoopPubsub: Pubsub = {
  async publish(): Promise<void> {
    /* drop */
  },
};

export class RecordingPubsub implements Pubsub {
  readonly published: Array<{ channel: string; payload: PubsubPayload }> = [];

  async publish(channel: string, payload: PubsubPayload): Promise<void> {
    this.published.push({ channel, payload });
  }
}

/**
 * Real Redis pubsub via Upstash. Loaded lazily so tests need no
 * `@upstash/redis` install.
 *
 * In addition to PUBLISH (for any future native subscriber), each payload is
 * LPUSH'd onto a capped log list `<channel>:log` (kept to the last 200). The
 * web `/live` SSE route (S6-T15) polls that list because Upstash's REST
 * client can't hold a long-lived SUBSCRIBE connection.
 */
const LIVE_LOG_MAX = 200;

export async function createRedisPubsub(redisUrl: string, redisToken: string): Promise<Pubsub> {
  const { Redis } = await import('@upstash/redis');
  const client = new Redis({ url: redisUrl, token: redisToken });
  return {
    async publish(channel, payload): Promise<void> {
      const json = JSON.stringify(payload, bigintReplacer);
      await client.publish(channel, json);
      const logKey = `${channel}:log`;
      await client.lpush(logKey, json);
      await client.ltrim(logKey, 0, LIVE_LOG_MAX - 1);
    },
  };
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}
