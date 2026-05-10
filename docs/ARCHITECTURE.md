# MCPX Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CONSUMER & DEV SURFACES                       │
│  apps/web (mcpx.gg)  │  cli (npx mcpxgg publish)  │  packages/sdk-*  │
│  /live dashboard     │  starter-template            │  embed widget   │
└──────────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────────────────────────────────────────────────────┐
│                          GATEWAY SERVICE                              │
│  apps/gateway — auth → resolve → settle (via facilitator) → forward   │
│  endpoint: mcp.mcpx.gg/mcp                                            │
└──────────────────────────────────────────────────────────────────────┘
                                  │
┌──────────────────────────────────────────────────────────────────────┐
│                  CHAIN ABSTRACTION LAYER (CAL)                        │
│  packages/chain — ChainAdapter interface + SuiAdapter (today)         │
│                   future: BaseAdapter, SolanaAdapter (zero-rewrite)   │
└──────────────────────────────────────────────────────────────────────┘
        │                                          │
┌──────────────────────────┐         ┌──────────────────────────────┐
│  apps/facilitator        │         │  apps/indexer                 │
│  x402 service:           │         │  Sui events → Postgres views  │
│  /verify  /settle  /sup. │         │  Redis pub/sub for /live      │
│  Apache 2.0 OSS          │         │                                │
│  facilitator.mcpx.gg     │         │                                │
└──────────────────────────┘         └──────────────────────────────┘
        │                                          │
┌──────────────────────────────────────────────────────────────────────┐
│                            SUI MAINNET                                │
│  Move package mcpx::*                                                 │
│    registry  session  settlement  vault  treasury  access             │
│    intent  staking  insurance  bundle  quality  events  admin         │
│  Walrus: receipts, READMEs, schemas (permanent)                       │
│  Seal:   per-call payload encryption                                  │
│  USDsui: settlement asset (gas-free transfers)                        │
│  Privy:  wallet + social login derivation                             │
└──────────────────────────────────────────────────────────────────────┘
```

## Data flow: a single tool call

```
1. User in Cursor/Claude Desktop calls a tool via mcp.mcpx.gg/mcp
2. Gateway authenticates the API key (Redis cache → Postgres fallback)
3. Gateway resolves the namespace → server endpoint via Postgres index
4. Gateway runs pre-flight checks (session balance, spending policies, scope, intents)
5. Gateway forwards the JSON-RPC request to the developer's endpoint
6. Developer's server returns result
7. Gateway uploads request/response payload to Walrus → Seal-encrypts → blob_id
8. Gateway calls facilitator /settle with the call details
9. Facilitator builds a single PTB:
     debit user's Session → credit DeveloperVault (97.5%)
                           → credit PlatformTreasury (2.0%)
                           → credit InsurancePool (0.5%)
                           → mint CallReceipt referencing blob_id
                           → emit CallSettled event
10. Indexer observes CallSettled, updates Postgres views
11. Gateway returns the tool result with _meta.receipt = { tx_digest, blob_id, amount, chain }
12. /live dashboard pushes the new event over SSE/WebSocket
```

If any step in the PTB fails, **all of it reverts** — that's why settlement is a single PTB. EVM equivalents take 4–5 separate transactions.

## Repos / deploy targets

| Component | Where it runs | Why |
|---|---|---|
| `apps/web` | Vercel | Consumer surface; ISR for marketplace |
| `apps/docs` | Vercel | Static + MDX |
| `apps/gateway` | Fly.io | Persistent connection to facilitator + Postgres + Redis; benefits from multi-region |
| `apps/facilitator` | Fly.io | Hot path for settlement; multi-region, sponsored gas |
| `apps/indexer` | Fly.io (one active, one passive) | Subscribes to Sui RPC; idempotent on `(tx_digest, event_seq)` |
| `contracts/` | Sui mainnet (post Sprint 6) | Move package address pinned in `.env` |
| `servers/<name>` | Vercel or per-server (developer's choice) | Each anchor server is independent |
| `cli/` | published as `@mcpxgg/cli` on npm | `npx mcpxgg publish` |

## Multi-chain readiness (Sui only today)

Every chain-touching call goes through `packages/chain`:

```ts
// packages/chain/src/types.ts
export interface ChainAdapter {
  chainId: ChainId;                              // 'sui' | 'base' | 'solana' | ...
  resolveIdentity(authToken: string): Promise<Identity>;
  deriveAddress(authIdentity: AuthIdentity): Promise<string>;
  facilitator: x402FacilitatorClient;
  settlementToken: TokenInfo;
  createSession(params): Promise<Session>;
  depositToSession(...): Promise<TxResult>;
  withdrawFromSession(...): Promise<TxResult>;
  publishServer(...): Promise<TxResult>;
  updateServer(...): Promise<TxResult>;
  settleCall(...): Promise<CallReceipt>;
  getDeveloperVault(...): Promise<DeveloperVault>;
  claimPayout(...): Promise<TxResult>;
  subscribeEvents(...): EventSubscription;
  txExplorerUrl(digest): string;
  objectExplorerUrl(id): string;
}
```

The web app uses `getActiveChain()` everywhere a chain detail surfaces. Today it returns SuiAdapter; tomorrow it could return a chain-selector. The user only sees "Sui" in three places: the footer, the about page, and the receipt details.

## Schema philosophy

Postgres schema is just a mirror. Every table relevant to chain state has:

```sql
chain_id text NOT NULL DEFAULT 'sui',
object_id text,
tx_digest text,
receipt_blob_id text  -- (for request_log only)
```

Adding Base/Solana later doesn't change query shape — just adds rows.

## Hot path latency budget

```
Gateway auth (Redis hit)           ~5 ms
Gateway server resolution          ~10 ms (Postgres index)
Forward to MCP server              ~50–500 ms (server-dependent)
Walrus blob upload                 ~150 ms (parallel with settlement)
Facilitator /settle (Sui PTB p50)  ~400 ms (network finality)
─────────────────────────────────────────
Total p50                          ~600–1100 ms

For non-streaming MCP tools, this is fine. For streaming (LLM inference), see Sprint 7
(pay-per-output streaming via x402 'upto' scheme).
```
