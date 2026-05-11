# @mcpxgg/facilitator

Open-source x402 facilitator for Sui. Validates payment payloads and settles
calls on-chain via the mcpx Move package. Apache 2.0 licensed; fork and
self-host or use the canonical instance at `facilitator.mcpx.gg`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness probe |
| GET | `/supported` | Lists supported schemes (`exact`, `upto`) and networks |
| POST | `/verify` | Validates signature + session balance + spending policies |
| POST | `/settle` | Builds + submits the `settle_call` PTB, returns tx digest + CallReceipt id |
| GET | `/admin/gas-station` | Snapshot of gas-station budgets (for monitoring) |

The on-the-wire shape uses decimal strings for any atomic amount; the
`@mcpxgg/x402` package owns the codecs.

## x402 compliance

This facilitator implements x402.org/spec:

- `/supported` returns the schemes + networks per the spec
- `/verify` returns `{ isValid, invalidReason?, message? }`
- `/settle` returns `{ success, txDigest?, receiptObjectId?, settledAmountAtomic?, errorCode?, errorMessage? }`

Sui-specific extensions to `PaymentPayload`:
- `sessionObjectId` — Sui object id of the session being debited
- `intentId` — optional spending intent (Sprint 6)

## Self-host

```bash
cp .env.example .env  # fill in MCPX_PACKAGE_ID, GAS_STATION_KEY, etc.
pnpm --filter @mcpxgg/facilitator dev      # local dev
pnpm --filter @mcpxgg/facilitator typecheck
pnpm --filter @mcpxgg/facilitator test
pnpm --filter @mcpxgg/facilitator start    # prod
```

Required env (non-test mode):
- `MCPX_PACKAGE_ID` — Sui object id of the deployed mcpx package
- `MCPX_PLATFORM_CONFIG_ID` — `PlatformConfig` shared object
- `MCPX_TREASURY_ID`, `MCPX_INSURANCE_ID`, `MCPX_REGISTRY_ID`
- `USDSUI_COIN_TYPE` — full type tag, e.g. `0x..::usdsui::USDSUI`
- `GAS_STATION_KEY` — Sui keypair private key (bech32 or hex)
- `SUI_NETWORK` — `sui-mainnet` | `sui-testnet` | `sui-devnet`
- `SUI_RPC_URL` — defaults per network

Optional:
- `PORT` — default 3002
- `GAS_STATION_RATE_LIMIT_PER_MIN` — default 60
- `GAS_STATION_DAILY_BUDGET_MIST` — default 1 SUI (1_000_000_000 MIST)
- `LOG_LEVEL` — pino level, default `info`

For tests / local-only experimentation, set `MCPX_FACILITATOR_TEST_MODE=1`
and every other env becomes optional. The boot path refuses to serve traffic
in test mode.

## Architecture

```
HTTP  ──►  app.ts  ──►  verify.ts ──►  SuiBackend.getSession / getPlatformConfig / verifyEd25519
                   ──►  settle.ts ──►  GasStation.check  ──►  SuiBackend.submitSettle
```

Only `sui/backend.ts` imports `@mysten/sui`. Tests inject
`createInMemorySuiBackend` for deterministic verification of every code path.
