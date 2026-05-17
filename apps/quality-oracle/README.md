# @mcpxgg/quality-oracle

S6-T18. Computes per-server quality from the indexed `request_log` and
attests it on-chain via `mcpx::quality::attest`. The on-chain
`QualityAttested` event is then mirrored back into `quality_attestations`
by `apps/indexer` (the oracle never writes Postgres — ADR-011).

## Windows

UTC-anchored, deterministic 6h windows. For a given `now`, the boundary is
`floor(now / 6h) * 6h`; the oracle measures the **prior closed** window
`[boundary - 6h, boundary)`. Re-running over the same `now` re-attests the
same window — idempotent at the windowing layer.

## Score formula (locked)

Per server, over the window:

- `uptime`   = successful calls / total calls
- `error_rate` = errored calls / total calls
- `p95`      = 95th-percentile observed `latency_ms` (nearest-rank)
- `latency_score` = clamp(1 − p95 / 2000ms, 0, 1)

```
score = 0.50·uptime + 0.30·(1 − error_rate) + 0.20·latency_score
```

All terms are fractions in [0,1]; reported `*_x100` values are `round(frac ×
10000)` clamped to `[0, 10000]` to satisfy the Move `u32 ≤ 10_000`
invariant. Rationale: availability dominates (a down server is worthless),
correctness next (wrong answers erode trust faster than slow ones), latency
is the tiebreaker. A server with **zero** calls in the window is not
attested — emitting a 0 would be a false signal.

## Modes

```sh
# one closed-window pass, then exit (CI / cron / backfill)
pnpm --filter @mcpxgg/quality-oracle run-once

# long-running loop: attests each new closed window
pnpm --filter @mcpxgg/quality-oracle start
```

## Env

| var | purpose |
|---|---|
| `MCPX_PACKAGE_ID` | deployed mcpx Move package id |
| `MCPX_ORACLE_CAP_ID` | owned `OracleCap` object id held by the signer |
| `MCPX_ORACLE_PRIVATE_KEY` | `suiprivkey1…` or `0x`-hex ed25519 secret |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | indexer-mirror read |
| `SUI_NETWORK` | `sui-mainnet \| sui-testnet \| sui-devnet` (default testnet) |
| `SUI_RPC_URL` | overrides the per-network default RPC |
| `ORACLE_POLL_INTERVAL_MS` | loop check cadence (default 5m; window is always 6h) |
| `MCPX_ORACLE_TEST_MODE=1` | bypass required env for unit tests |

## Testing

The compute core (`oracle.ts`) is pure and tested fully offline with
injected store + chain clients — no network, no DB, no clock. `pnpm
--filter @mcpxgg/quality-oracle test`.
