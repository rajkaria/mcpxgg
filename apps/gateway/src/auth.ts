/**
 * API-key authentication: Redis/memory cache → store fallback.
 * Returns the resolved on-chain session context for the key.
 */

import type { GatewayCache } from './cache/cache.js';
import type { AuthContext, GatewayStore } from './store/store.js';
import { GatewayError } from './errors.js';

const AUTH_TTL_SECONDS = 60;

interface AuthWire {
  userId: string;
  apiKey: string;
  ownerAddress: string;
  sessionObjectId: string;
  balanceAtomic: string;
  perCallCapAtomic: string;
  perDayCapAtomic: string;
  todaySpentAtomic: string;
  todayEpochDay: number | null;
  scopedServerObjectIds: string[];
  active: boolean;
  expiresAtMs: number | null;
}

function toWire(a: AuthContext): AuthWire {
  return {
    ...a,
    balanceAtomic: a.balanceAtomic.toString(),
    perCallCapAtomic: a.perCallCapAtomic.toString(),
    perDayCapAtomic: a.perDayCapAtomic.toString(),
    todaySpentAtomic: a.todaySpentAtomic.toString(),
  };
}

function fromWire(w: AuthWire): AuthContext {
  return {
    ...w,
    balanceAtomic: BigInt(w.balanceAtomic),
    perCallCapAtomic: BigInt(w.perCallCapAtomic),
    perDayCapAtomic: BigInt(w.perDayCapAtomic),
    todaySpentAtomic: BigInt(w.todaySpentAtomic),
  };
}

/** Pull the API key from `Authorization: Bearer` or `X-API-Key`. */
export function extractApiKey(headers: Headers): string {
  const auth = headers.get('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  const x = headers.get('x-api-key');
  if (x) return x.trim();
  throw new GatewayError('Missing API key', 'auth_required');
}

export async function authenticate(
  apiKey: string,
  store: GatewayStore,
  cache: GatewayCache,
): Promise<AuthContext> {
  if (!apiKey) throw new GatewayError('Missing API key', 'auth_required');

  const cacheKey = `auth:${apiKey}`;
  const cached = await cache.getJSON<AuthWire>(cacheKey);
  if (cached) return fromWire(cached);

  const ctx = await store.getAuthByApiKey(apiKey);
  if (!ctx) throw new GatewayError('Invalid API key or no active session', 'invalid_api_key');

  await cache.setJSON(cacheKey, toWire(ctx), AUTH_TTL_SECONDS);
  return ctx;
}
