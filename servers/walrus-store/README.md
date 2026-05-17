# walrus-store

Anchor MCP server #4 (Sprint 6, S6-T09/T10). Agent-native blob storage on
Walrus with x402 micropayments — upload bytes, retrieve by id, inspect
metadata, and list your blobs.

Built on `@mcpxgg/server`. Every paid call settles in USDsui through the
mcpxgg gateway → x402 facilitator and returns a verifiable on-chain receipt.

## Tools

| Tool | Price (USDsui atomic) | Free tier | Description |
|---|---|---|---|
| `upload` | 12000 | 1 / user | Store base64 bytes (+ optional name/metadata) → blob id. |
| `retrieve` | 4000 | 3 / user | Fetch a blob by id; content returned base64-encoded. |
| `metadata` | 2000 | 3 / user | Size, content-type, stored epoch, owner, name, custom metadata. |
| `list` | 1000 | 3 / user | List your blobs by owner/name prefix, newest first. |

## Architecture

- **Walrus client** (`@mcpxgg/walrus`): in-memory content-addressed backend by
  default (hermetic CI + zero-config demo). Set `WALRUS_PUBLISHER_URL` /
  `WALRUS_AGGREGATOR_URL` (+ optional `WALRUS_EPOCHS`) to persist to a real
  Walrus network. The `WalrusClient` interface is the only contract.
- **Blob catalog** (`src/store.ts`): Walrus stores only bytes and has no
  notion of owner/name/content-type, so this side-band index records that
  metadata for `metadata` and `list`. In-memory by default; in production it
  is the indexer Postgres mirror (read-fast, rebuildable from chain — never
  the source of truth).
- **Input safety** (security-critical): the gateway treats all tool input as
  untrusted. `retrieve`/`metadata` take a caller-supplied blob id —
  `validateBlobId` enforces a conservative charset (`[A-Za-z0-9:_-]`, ≤256
  chars) so the opaque id cannot be weaponised for SSRF / path traversal
  against the HTTP backend's aggregator URL. `upload` rejects non-base64,
  empty, and oversized (>16 MiB) payloads.

## Run locally

```bash
pnpm --filter @mcpxgg/walrus-store dev   # listens on :3013
```

Boots fully offline (in-memory Walrus + in-memory catalog); no keys required.

## Test

```bash
pnpm --filter @mcpxgg/walrus-store test
```
