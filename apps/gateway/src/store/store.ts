/**
 * GatewayStore — the read boundary for auth + tool resolution.
 *
 * Per ADR-011, Postgres is an indexer mirror, not the source of truth. The
 * gateway only *reads* it (api key → session, namespace → server, tool price).
 * It never writes server/tool/receipt rows — the indexer hydrates those from
 * chain events. The facilitator owns the settlement write.
 */

/** Resolved from the caller's API key. The session fields mirror the on-chain
 *  Session<USDsui> object via the `chain_balances` view. */
export interface AuthContext {
  userId: string;
  apiKey: string;
  ownerAddress: string;
  sessionObjectId: string;
  balanceAtomic: bigint;
  perCallCapAtomic: bigint;
  perDayCapAtomic: bigint;
  todaySpentAtomic: bigint;
  todayEpochDay: number | null;
  /** Empty array = key may call any server (unscoped). */
  scopedServerObjectIds: string[];
  active: boolean;
  expiresAtMs: number | null;
}

export interface ResolvedServer {
  serverObjectId: string;
  namespace: string;
  endpointUrl: string;
  active: boolean;
}

export interface ResolvedTool {
  toolName: string;
  description: string;
  inputSchema: Record<string, unknown>;
  priceAtomic: bigint;
  freeTierCallsPerUser: number;
  timeoutSeconds: number;
}

export interface GatewayStore {
  getAuthByApiKey(apiKey: string): Promise<AuthContext | null>;
  resolveServer(namespace: string): Promise<ResolvedServer | null>;
  resolveTool(serverObjectId: string, toolName: string): Promise<ResolvedTool | null>;
  /** All tools for a server, for tools/list. */
  listTools(serverObjectId: string): Promise<ResolvedTool[]>;
  /** Active servers a key may see in tools/list. */
  listScopedServers(auth: AuthContext): Promise<ResolvedServer[]>;
}
