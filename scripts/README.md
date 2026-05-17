# Operational Scripts

| Script | Sprint | Purpose |
|---|---|---|
| `deploy-testnet.sh` | S1 | Deploy Move package to testnet, init shared objects |
| `deploy-mainnet.sh` | S5 | Multisig-gated mainnet deploy |
| `fund-test-account.sh` | S1 | Get USDsui from testnet faucet |
| `seed-bundles.ts` | S5 | Build/print the 3 curated bundle `bundle::create` PTBs (dry-run; on-chain submit gated on S5-T22 mainnet deploy) |
| `migrate-web2-users.ts` | S8 | Web2 → Sui migration (legacy `credit_balance` → bootstrap Session) |
| `loadtest/` | S8 | Gateway + facilitator loadtest harness (dry self-check by default) |
| `sprints-to-csv.js` | (optional) | Export `docs/SPRINTS.md` task tables to CSV for spreadsheet ingestion |

## `@mcpxgg/scripts` workspace package

`scripts/` is a private workspace package so it is covered by
`pnpm turbo run typecheck` and `pnpm turbo run test` like every other package.

```sh
pnpm --filter @mcpxgg/scripts typecheck
pnpm --filter @mcpxgg/scripts test
```

### S8-T01 — `migrate-web2-users.ts`

Conversion rule (SPRINTS S8-T01 cites "per ADR-008 1:1"): ADR-008 fixes the
USDsui atomic convention — **$1.00 = 1,000,000 atomic units (6 decimals)**.
Legacy `credit_balance` is a whole-dollar INTEGER (`002_billing_schema.sql`),
1 credit = $1.00, so `depositAtomic = credit_balance * 1_000_000`. Straight
1:1 carryover, no fee.

```sh
# dry-run (signs nothing), JSON export source
tsx scripts/migrate-web2-users.ts --dry-run --source=json --file=./legacy.json

# real run against the legacy Supabase, concurrency 4
LEGACY_SUPABASE_URL=... LEGACY_SUPABASE_SERVICE_KEY=... \
MIGRATOR_PRIVATE_KEY=suiprivkey1... MCPX_PACKAGE_ID=0x... \
USDSUI_COIN_TYPE=0x...::usdsui::USDSUI MCPX_SESSION_REGISTRY_ID=0x... \
tsx scripts/migrate-web2-users.ts --source=supabase --concurrency=4
```

Idempotent: `migration_status='migrated'` users are skipped; status flips
`migrating → migrated` so a crash mid-run is safely retried.

### S8-T09 — loadtest harness

Default is a **dry self-check** (stub fetch, no backend — CI/offline safe):

```sh
tsx scripts/loadtest/index.ts                       # dry, ~2s smoke
```

Against a real deployment:

```sh
MCPX_API_KEY=mcpx_sk_... tsx scripts/loadtest/index.ts \
  --live --base-url=https://gateway.mcpx.gg \
  --rps=100 --duration=30 --tool=walrus-store_metadata
```

Reports p50/p95/p99 + max latency, throughput, error-rate (broken down by
gateway error code) and a PASS/FAIL verdict against `--p95`,
`--max-error-rate`, `--min-throughput` thresholds; exits non-zero on FAIL so
it can gate CI or a deploy step.
