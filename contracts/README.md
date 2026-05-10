# MCPX Move Package

The on-chain settlement layer for mcpxgg. **Sprint 0** stub. **Sprint 1** fills in the 13 modules.

See `docs/SPRINTS.md` Sprint 1 for the module-by-module build plan.

## Build

```bash
cd contracts
sui move build
```

## Test

```bash
sui move test
```

## Deploy (testnet, Sprint 1)

```bash
sui client switch --env testnet
bash scripts/deploy-testnet.sh
```

## Deploy (mainnet, Sprint 5)

```bash
# Multisig-gated; see scripts/deploy-mainnet.sh
```

## Modules (Sprint 1 target)

| Module | Purpose |
|---|---|
| `mcpx::registry` | Server objects + tool metadata + namespace uniqueness |
| `mcpx::session` | User USDsui balance + spending policies |
| `mcpx::settlement` | Atomic single-PTB settlement (debit, split, mint receipt) |
| `mcpx::vault` | Developer earnings vaults |
| `mcpx::treasury` | Platform fee collection |
| `mcpx::insurance` | InsurancePool — 0.5% take + slashed stakes |
| `mcpx::access` | ScopedKey for per-server / org / member permissions |
| `mcpx::intent` | SpendingIntent — agent budget delegation (Sprint 6) |
| `mcpx::staking` | ServerStake + auto-slash (Sprint 7) |
| `mcpx::bundle` | Composable Bundle (Sprint 5) |
| `mcpx::quality` | QualityAttestation from oracle |
| `mcpx::events` | All event types for indexer |
| `mcpx::admin` | UpgradeCap + PlatformConfig |

## Configuration parameters (`PlatformConfig` shared object)

| Param | Default | Mutable by | Sprint |
|---|---|---|---|
| `take_rate_bps` | 250 (2.5%) | Admin multisig | S1 |
| `insurance_bps` | 50 (0.5% of take) | Admin multisig | S1 |
| `bootstrap_subsidy_atomic` | 1_000_000 (1.00 USDsui) | Admin multisig | S4 |
| `subsidy_monthly_budget_atomic` | 500_000_000_000 | Admin multisig | S4 |
| `min_sla_stake_atomic` | 10_000_000 (10 USDsui) | Admin multisig | S7 |

## License

The Move package itself is not yet open-source. The accompanying SDKs and facilitator are Apache 2.0 (see ADR-006).
