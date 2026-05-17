# sui-defi-data

Anchor MCP server #2 (Sprint 5). Normalized Sui DeFi data across Cetus,
Bluefin, Scallop, Navi and DeepBook — liquidity pools, spot prices, pool
history and best-route swap quotes.

Built on `@mcpxgg/server`. Every paid call settles in USDsui through the
mcpxgg gateway → x402 facilitator and returns a verifiable on-chain receipt.

## Tools

| Tool | Price (USDsui atomic) | Free tier | Description |
|---|---|---|---|
| `pools` | 2000 | 3 / user | List normalized pools `{ protocol, poolId, tokenA, tokenB, tvlUsd, apr, volume24hUsd }`. |
| `prices` | 1000 | 5 / user | Spot USD prices `{ symbol, priceUsd, source, ts }`. |
| `pool_history` | 3000 | 0 | Daily series `{ date, tvlUsd, volumeUsd, apr }` (default 7 days). |
| `swap_quote` | 2000 | 0 | Best-route quote `{ protocol, amountOut, priceImpactPct, route, feeUsd }`. |

## Architecture

- **Data source** (`src/data-source.ts`): the `DefiDataSource` interface is a
  normalized facade (`getPools`, `getPrices`, `getPoolHistory`,
  `getSwapQuote`) — tool logic never sees a protocol-specific payload (S5-T02).
  - `createStaticDefiDataSource(seed)`: deterministic in-memory fixture. The
    **default** when no env is configured, so the server boots and demos
    fully offline and CI stays hermetic (mirrors walrus-search's in-memory
    vector store default).
  - `createHttpDefiDataSource(env)`: real impl that calls each protocol's
    public endpoint via `fetch`. Each protocol call is independently
    try/caught and **degrades gracefully** to the static fixture, so one dead
    upstream never fails the whole tool.
- **Injectable deps**: `createSuiDefiDataServer({ dataSource })` defaults to
  env-or-static; tests inject a static source for hermetic runs.

## Environment

All optional. If none are set, the server runs on the deterministic fixture.

| Var | Purpose |
|---|---|
| `DEFI_CETUS_URL` | Cetus pools/history/quote base URL. |
| `DEFI_BLUEFIN_URL` | Bluefin base URL. |
| `DEFI_SCALLOP_URL` | Scallop base URL. |
| `DEFI_NAVI_URL` | Navi base URL. |
| `DEFI_DEEPBOOK_URL` | DeepBook base URL. |
| `DEFI_PRICE_URL` | Aggregated spot-price oracle base URL. |
| `PORT` | Listen port (default 3011). |

Expected upstream shapes (normalized internally): `GET {base}/pools`,
`GET {base}/pools/{poolId}/history?days=N`,
`GET {base}/quote?tokenIn&tokenOut&amountIn`, and
`GET {priceUrl}/prices?symbols=A,B`.

## Run locally

```bash
pnpm --filter @mcpxgg/sui-defi-data dev   # listens on :3011
```

## Test

```bash
pnpm --filter @mcpxgg/sui-defi-data test
```
