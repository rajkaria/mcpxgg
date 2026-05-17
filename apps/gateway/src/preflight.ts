/**
 * Pre-flight checks (S3-T03). Runs before the tool executes — a failed check
 * means no server call and no settlement. The chain re-enforces all of this
 * atomically in settle_call; this is the fast fail so we don't call a paid
 * server we already know we can't settle.
 */

import type { AuthContext, ResolvedServer, ResolvedTool } from './store/store.js';
import { GatewayError } from './errors.js';

export interface PreflightInput {
  auth: AuthContext;
  server: ResolvedServer;
  tool: ResolvedTool;
  /** Amount that will actually be settled (0 if free-tier). */
  chargeAtomic: bigint;
  nowMs: number;
}

const DAY_MS = 86_400_000;

export function preflight(input: PreflightInput): void {
  const { auth, server, tool, chargeAtomic, nowMs } = input;

  if (!auth.active) {
    throw new GatewayError('Session is inactive', 'session_inactive');
  }
  if (auth.expiresAtMs !== null && nowMs >= auth.expiresAtMs) {
    throw new GatewayError('Session expired', 'session_expired');
  }
  if (!server.active) {
    throw new GatewayError(`Server ${server.namespace} is not active`, 'server_not_found');
  }

  // Scoped key: empty list = unscoped (any server allowed).
  if (
    auth.scopedServerObjectIds.length > 0 &&
    !auth.scopedServerObjectIds.includes(server.serverObjectId)
  ) {
    throw new GatewayError(
      `API key not scoped to ${server.namespace}`,
      'server_not_scoped',
    );
  }

  if (chargeAtomic === 0n) return; // free-tier call — caps/balance not relevant

  if (chargeAtomic > tool.priceAtomic) {
    // Defensive: charge should never exceed list price.
    throw new GatewayError('charge exceeds tool price', 'server_error');
  }
  if (auth.perCallCapAtomic > 0n && chargeAtomic > auth.perCallCapAtomic) {
    throw new GatewayError(
      `Call costs ${chargeAtomic} > per-call cap ${auth.perCallCapAtomic}`,
      'per_call_cap_exceeded',
    );
  }
  if (auth.balanceAtomic < chargeAtomic) {
    throw new GatewayError(
      `Balance ${auth.balanceAtomic} < cost ${chargeAtomic}`,
      'insufficient_balance',
    );
  }
  if (auth.perDayCapAtomic > 0n) {
    const todayEpochDay = Math.floor(nowMs / DAY_MS);
    const spentToday =
      auth.todayEpochDay === todayEpochDay ? auth.todaySpentAtomic : 0n;
    if (spentToday + chargeAtomic > auth.perDayCapAtomic) {
      throw new GatewayError(
        `Daily spend ${spentToday + chargeAtomic} would exceed cap ${auth.perDayCapAtomic}`,
        'per_day_cap_exceeded',
      );
    }
  }
}
