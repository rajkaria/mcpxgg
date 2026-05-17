# sui-identity

Anchor MCP server #5 (Sprint 6, S6-T11/T12/T13). zkLogin-aware identity
resolver — SuiNS name ↔ address, zkLogin proof verification, and
CallReceipt-derived address reputation.

Built on `@mcpxgg/server`. Every paid call settles in USDsui through the
mcpxgg gateway → x402 facilitator and returns a verifiable on-chain receipt.

## Tools

| Tool | Price (USDsui atomic) | Free tier | Description |
|---|---|---|---|
| `resolve_address` | 1000 | 5 / user | SuiNS name (alice.sui) → owner address. |
| `resolve_name` | 1000 | 5 / user | Address → primary SuiNS name. |
| `verify_zklogin` | 5000 | 1 / user | zkLogin proof envelope → { valid, issuer, subHash }. |
| `address_reputation` | 2000 | 3 / user | Address → reputation from on-chain CallReceipt count. |

## Architecture

All three lookups are injectable interfaces (`src/resolvers.ts`) so prod
swaps in real adapters without touching tool logic. The default factory is
deterministic and fully offline — hermetic CI + zero-config demo.

- **SuiNS** (`SuiNsResolver`): offline resolver seeded from a small fixture
  map by default. Prod replaces it with the SuiNS indexer (set
  `SUINS_INDEXER_URL` / `SUI_RPC_URL` and inject the prod adapter).
- **zkLogin** (`ZkLoginVerifier`): the offline verifier validates the proof
  *envelope* (known OIDC issuer, present sub/aud, well-formed Groth16
  `proofPoints`). It does **not** run the cryptographic Groth16 check — that
  needs the verifying key + network. A `valid:true` from the stub means
  "well-formed", not "cryptographically verified"; prod implements the same
  interface against the canonical zkLogin verifier. The raw OIDC `sub` is
  never returned — only a salted `sha256(issuer|sub)` hash.
- **Reputation** (`ReputationStore`): score (0..100) + tier derived from the
  payer's `CallReceipt` count. This reads the **indexer mirror**
  (`call_receipts` Postgres table) — rebuildable from chain, never the
  source of truth and never the chain directly. Offline store is fixture-fed;
  prod injects the Postgres-backed store (`IDENTITY_PG_URL`).

## Security

The gateway treats all tool input as untrusted. Addresses are validated
against `^0x[0-9a-fA-F]{1,64}$` and SuiNS names against a strict label
regex before use; the zkLogin verifier never echoes the raw subject.

## Run locally

```bash
pnpm --filter @mcpxgg/sui-identity dev   # listens on :3014
```

Boots fully offline (deterministic resolvers); no keys required.

## Test

```bash
pnpm --filter @mcpxgg/sui-identity test
```
