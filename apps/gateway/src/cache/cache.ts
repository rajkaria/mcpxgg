/**
 * GatewayCache — auth memoisation + per-user free-tier counters.
 *
 * Free-tier ("first N calls per user per tool are not settled") needs a
 * durable counter. Redis in prod; in-memory for tests/dev. The on-chain
 * settlement is still the source of truth for spend; this only decides the
 * *amount* the gateway asks the facilitator to settle (0 while free).
 */

export interface GatewayCache {
  getJSON<T>(key: string): Promise<T | null>;
  setJSON(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  /** Atomic increment, returns the new value. */
  incr(key: string): Promise<number>;
}

export function createMemoryCache(): GatewayCache {
  const store = new Map<string, { v: unknown; exp: number | null }>();
  const counters = new Map<string, number>();
  return {
    async getJSON<T>(key: string): Promise<T | null> {
      const e = store.get(key);
      if (!e) return null;
      if (e.exp !== null && Date.now() > e.exp) {
        store.delete(key);
        return null;
      }
      return e.v as T;
    },
    async setJSON(key, value, ttlSeconds) {
      store.set(key, { v: value, exp: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null });
    },
    async incr(key) {
      const n = (counters.get(key) ?? 0) + 1;
      counters.set(key, n);
      return n;
    },
  };
}

export async function createRedisCache(
  restUrl: string,
  restToken: string,
): Promise<GatewayCache> {
  const { Redis } = await import('@upstash/redis');
  const redis = new Redis({ url: restUrl, token: restToken });
  return {
    async getJSON<T>(key: string): Promise<T | null> {
      return (await redis.get<T>(key)) ?? null;
    },
    async setJSON(key, value, ttlSeconds) {
      await redis.set(key, value, ttlSeconds > 0 ? { ex: ttlSeconds } : undefined);
    },
    async incr(key) {
      return redis.incr(key);
    },
  };
}
