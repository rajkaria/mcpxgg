# sui-analytics

Anchor MCP server #3 (Sprint 5, S5-T04/T05). Natural-language analytics over
indexed Sui state — whale alerts, address & object history, ad-hoc questions.

Built on `@mcpxgg/server`. Every paid call settles in USDsui through the
mcpxgg gateway → x402 facilitator and returns a verifiable on-chain receipt.

## Tools

| Tool | Price (USDsui atomic) | Free tier | Description |
|---|---|---|---|
| `query` | 8000 | 1 / user | NL question → guarded read-only SQL → rows over indexed Sui state. |
| `address_history` | 3000 | 0 | Tx/transfer history for an address, newest first. |
| `object_history` | 3000 | 0 | Version/owner history for an object, newest version first. |
| `whale_alert` | 2000 | 0 | Transfers ≥ a USD threshold within a trailing window. |

## Architecture

- **NL→SQL** (`src/llm.ts`): deterministic rule-based translator by default
  (hermetic CI + zero-config demo). Set `ANTHROPIC_API_KEY` to upgrade to
  Claude Haiku (`claude-haiku-4-5-20251001`); the Anthropic path degrades back
  to the heuristic on any network/key/parse failure. The `SqlLlm` interface is
  the only contract.
- **Store** (`src/store.ts`): in-memory, fixture-seeded `AnalyticsStore` by
  default. **It is not a SQL engine** — `runSql` is a safe canned-query router
  that recognises the small set of SELECT shapes the heuristic emits and
  answers them from deterministic fixtures; unrecognised shapes are rejected.
  In production this is swapped for a Postgres + ClickHouse adapter (mirror of
  the apps/indexer state) whose `runSql` forwards the guard-validated SQL to
  the real engine. No eval, no real parser, no DB in CI.
- **SQL safety guard** (`src/sql-guard.ts`, security-critical): the gateway
  treats all tool input as untrusted and the `query` SQL is LLM-generated from
  attacker-controllable text. Every generated statement must pass `guardSql`
  before it reaches the store. Rules:
  1. Single statement — no `;` anywhere (defeats stacked queries).
  2. Must start with `SELECT` or `WITH` (read-only entrypoint).
  3. No DDL/DML/side-effecting keywords anywhere (INSERT, UPDATE, DELETE,
     DROP, ALTER, CREATE, TRUNCATE, GRANT, REVOKE, ATTACH, PRAGMA, COPY,
     MERGE, REPLACE, CALL, EXEC, VACUUM, SET/INTO, LOAD, …) — whole-word match
     so `created_at`/`updated_at` are fine.
  4. No SQL comments (`--`, `#`, `/* */`) — classic bypass vector.
  5. An explicit, sane `LIMIT` (1..1000) is required — unbounded scans are
     rejected, not silently capped.
  The guard is conservative: it rejects anything it does not positively
  recognise as a safe bounded SELECT.

## Run locally

```bash
pnpm --filter @mcpxgg/sui-analytics dev   # listens on :3012
```

Boots fully offline (in-memory store + heuristic NL→SQL); no keys required.

## Test

```bash
pnpm --filter @mcpxgg/sui-analytics test
```
