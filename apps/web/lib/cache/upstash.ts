import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

export async function cacheGet<T>(key: string): Promise<T | null> {
  return redis.get<T>(key);
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number) {
  await redis.set(key, value, { ex: ttlSeconds });
}

export async function cacheDel(key: string) {
  await redis.del(key);
}
