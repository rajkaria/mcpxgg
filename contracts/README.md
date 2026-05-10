# MCPX Move Package

Sui-native contracts powering the mcpxgg marketplace. 13 modules implement
the publish → session → settle → claim flow with on-chain take-rate
configuration, SLA staking (stub today, S7), spending intents (stub today,
S6), and composable bundles (stub today, S5).

## Modules

| Module | Purpose | Status |
|---|---|---|
| `events` | All event types + `public(package)` emit helpers | ✓ S1 |
| `admin` | `PlatformConfig` (take_rate_bps, insurance_bps, subsidy, paused) + `AdminCap` | ✓ S1 |
| `treasury` | `PlatformTreasury<T>` — collects 200 bps of every settled call | ✓ S1 |
| `insurance` | `InsurancePool<T>` — collects 50 bps; pays out via `InsurancePayerCap` | ✓ S1 |
| `vault` | `DeveloperVault<T>` — accrues 9750 bps to dev; owner-gated `claim` | ✓ S1 |
| `registry` | `Server`, `Tool`, `ServerOwnerCap`, `NamespaceRegistry` | ✓ S1 |
| `session` | `Session<T>`, `SessionKey` — pre-funded escrow with caps + scope | ✓ S1 |
| `settlement` | `CallReceipt` + atomic `settle_call` PTB | ✓ S1 |
| `quality` | `QualityAttestation` + `OracleCap` for off-chain quality oracle | ✓ S1 |
| `access` | `ScopedKey` — API key derivation stub | ◐ S1 stub → S4 wired |
| `intent` | `SpendingIntent` — agent budget delegation stub | ◐ S1 stub → S6 wired |
| `staking` | `ServerStake<T>` + slash-to-insurance flow | ◐ S1 stub → S7 wired |
| `bundle` | `Bundle` — curated server group with price multiplier | ◐ S1 stub → S5 wired |

## The atomic PTB

Every settled call goes through `settlement::settle_call<T>` in a single
transaction:

```
debit session  → split take rate
              ├─ 50 bps  → insurance::collect
              ├─ 200 bps → treasury::collect
              └─ 9750 bps → vault::accrue
              ↓
              mint CallReceipt (soulbound to payer)
              ↓
              emit CallSettled
```

Any failed step reverts the whole PTB — no one is paid, no receipt is minted.

## Build / test

```sh
sui move build              # all 13 modules
sui move test               # full suite (65 tests as of S1)
sui move test --coverage    # +coverage report
sui move coverage summary   # coverage breakdown by module
```

`scripts/run-move-tests.sh` runs build + test + coverage in one go (used by CI).

## Deploy

```sh
sui client switch --env testnet
./scripts/deploy-testnet.sh \
  --coin-type 0x2::sui::SUI                # placeholder; swap for USDsui type tag
```

The script:
1. `sui move build`
2. `sui client publish` → captures package id
3. Initializes `PlatformTreasury<T>` and `InsurancePool<T>` for the chosen coin
4. Prints a copy-paste `.env` block with package id, registry id, treasury id,
   insurance id, config id, admin cap id

`PlatformConfig`, `NamespaceRegistry`, and `AdminCap` are created automatically
by each module's `init` at publish time.

## Sprint 1 checklist

- [x] `Move.toml` with framework dep
- [x] All 13 modules build clean
- [x] 65 Move tests, 77.54% line coverage (admin/vault/treasury 100%, registry 90%, settlement 82%)
- [x] E2E test: publish → session → 3× settle → claim → close
- [x] Deploy script
- [x] Schema migration 006 (Postgres mirror columns)
- [x] TS types + validation schema with `priceAtomic: bigint`
- [ ] First testnet deploy (S1-T17 — needs Sui keystore + testnet SUI)
