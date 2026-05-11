# @mcpxgg/indexer

Drains mcpx Move events from Sui RPC into the Supabase indexer-mirror schema.

## Architecture

```
Sui RPC queryEvents ──► EventSource ──► runner.tick ──► dispatch ──► Storage.upsert*
                                                                  ──► Pubsub.publish (live page)
```

Three pluggable interfaces:

- **EventSource** — `sui-source.ts` (real Sui) / `in-memory.ts` (tests)
- **Storage** — `supabase.ts` (real Postgres) / `in-memory.ts` (tests)
- **Pubsub** — `redis.ts` (Upstash) / `NoopPubsub` (when no Redis configured) / `RecordingPubsub` (tests)

The runner is a pure function over those three. Dedup is enforced by the
`(tx_digest, event_seq)` primary key — a crash mid-batch followed by
restart never produces a duplicate row.

## Self-host

```bash
pnpm --filter @mcpxgg/indexer dev    # local dev (watches src/)
pnpm --filter @mcpxgg/indexer typecheck
pnpm --filter @mcpxgg/indexer test
pnpm --filter @mcpxgg/indexer start  # prod
```

Required env:
- `MCPX_PACKAGE_ID` — Sui package object id (events are filtered to `<pkg>::events`)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `SUI_NETWORK` — `sui-mainnet` | `sui-testnet` | `sui-devnet`

Optional:
- `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_TOKEN` — enables the live-page pubsub channel
- `INDEXER_POLL_INTERVAL_MS` — default 1000
- `INDEXER_PAGE_SIZE` — default 50
- `HEALTH_PORT` — default 3003
- `SUI_RPC_URL` — defaults per network

For tests, set `MCPX_INDEXER_TEST_MODE=1`. The boot path refuses to run
in test mode.

## Replay semantics

The checkpoint table `indexer_checkpoints` stores `(checkpoint, event_seq, tx_digest)`.
On startup the runner reads the row, hands its `(tx_digest, event_seq)` to
the event source as a Sui-RPC cursor, and forward-drains. Crash-restart
behaviour is verified by `runner.test.ts > survives a duplicate batch`.

## Adding a new event

1. Add the variant to `EventType` (and `ALL_EVENT_TYPES`) in `src/types.ts`.
2. Add a handler in `src/handlers/<module>.ts` and export it.
3. Register the handler in the dispatch `TABLE` in `src/handlers/dispatch.ts`.
4. Add a test in `src/handlers/dispatch.test.ts`.
5. If the event should appear on the live page, add it to `LIVE_EVENT_TYPES`.
