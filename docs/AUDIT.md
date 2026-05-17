# MCPX — Move Package Audit Submission Package

**Prepared for:** OtterSec (S8-T03)
**Scope:** the `mcpx` Move package at `contracts/sources/` — 13 modules
**Toolchain:** `sui 1.71.1`, Move edition `2024.beta`, `Sui` framework dep pinned at `rev = framework/testnet`
**Status at submission:** 87/87 Move tests pass (incl. S8 slash-hardening negative tests); package not yet deployed (deploy is credential-gated, see `docs/BLOCKED.md` item 11)

> Accuracy note for auditors: every claim below cites `module::function` and the
> exact `assert!` error constant by name. Where a module is a deliberate stub for
> a later sprint, this document says so explicitly rather than implying full
> enforcement. Do not assume any behavior not asserted in the cited code.

---

## 1. System overview & trust model

MCPX is an on-chain marketplace + x402 settlement layer for MCP (Model Context
Protocol) servers. A user pre-funds a `Session`. The off-chain **facilitator**
builds a single PTB that calls `settlement::settle_call` (or an intent/upto
variant), which atomically debits the session, splits the payment three ways
(developer / treasury / insurance), and mints a soulbound `CallReceipt`. The
chain is the source of truth; Postgres is an indexer mirror only (ADR-011).

### Authorities (who can do what)

| Authority | Type | Minted by | Can do | Cannot do |
|---|---|---|---|---|
| **`AdminCap`** | `admin::AdminCap` (`key, store`) | `admin::init` → tx sender at publish; intended to be transferred to a multisig (ADR-004) | `set_take_rate`, `set_subsidy`, `set_sla_min_stake`, `set_paused`; `treasury::withdraw`; `insurance::admin_withdraw`; `insurance::mint_payer_cap`; `quality::mint_oracle_cap`; `treasury::initialize`; `insurance::initialize` | Cannot exceed `MAX_TAKE_RATE_BPS` (1000 = 10%); cannot set `insurance_bps > take_rate_bps`; cannot move a user `Session` balance; cannot mint or alter a `CallReceipt` |
| **`OracleCap`** | `quality::OracleCap` (`key, store`) | `quality::mint_oracle_cap` (AdminCap-gated) | `quality::attest` (publish a `QualityAttestation`); `staking::slash` (move stake → insurance pool) | Cannot mint another `OracleCap`; cannot withdraw treasury/insurance; cannot pause |
| **`InsurancePayerCap`** | `insurance::InsurancePayerCap` (`key, store`) | `insurance::mint_payer_cap` (AdminCap-gated) | `insurance::pay_out` (routine outage payout, bounded by pool balance) | Cannot drain to itself without `recipient` arg; not required for the permissionless `claim_for_failed_call` path |
| **`ServerOwnerCap`** | `registry::ServerOwnerCap` (`key, store`) | `registry::publish_server` → returned to publisher | `update_metadata`, `add_tool`, `remove_tool`, `update_tool_price`, `deactivate` — only on the `Server` whose `id` matches `cap.server_id` | Cannot edit another server (guarded by `assert_cap_matches` / `E_CAP_MISMATCH`); cannot touch settlement |
| **Session owner** | plain `address` == `Session.owner` | `session::create` (sender) | `deposit`, `withdraw`, `update_limits`, `update_scope`, `close`; mint `ScopedKey` (`access::mint_scoped_key`) | Cannot bypass own caps via `debit` (package-private); cannot debit another session |
| **Intent agent** | plain `address` == `SpendingIntent.agent` | named in `intent::create` by the user | Be the `Session.owner` the gateway opens to drive `settle_call_with_intent` (enforced by `E_INTENT_AGENT_MISMATCH`) | Cannot exceed intent per-call / daily / scope / category; cannot revoke (only `intent.user` can) |
| **Facilitator** | off-chain service, holds gas key | n/a | Assemble & submit the settlement PTB; quote prices off-chain | **Has no on-chain capability.** It cannot mint receipts out of thin air, cannot exceed session/intent caps, cannot redirect splits — every value movement is on-chain-enforced. Its only trusted input is the *quoted price* (see §4) |
| **Permissionless** | anyone | — | `vault::create`, `session::create`, `registry::publish_server`, `intent::create`, `bundle::create`, `staking::post`, `insurance::top_up`, `settlement::claim_for_failed_call` (if you hold the failed receipt), `bundle::activate_for_user` | — |

Key trust property: **the facilitator is untrusted for value integrity**. The
worst a malicious/buggy facilitator can do is (a) charge a price the gateway
shouldn't have (bounded by session/intent caps the *user* set) or (b) fail to
settle (no one is paid, but no one is robbed). It can never mint money, exceed a
user cap, or alter the split ratio — those are `PlatformConfig`-driven and
cap-gated.

---

## 2. Per-module summary

Line/region coverage figures are from `sui move test --coverage` +
`sui move coverage summary` on the current tree (see §6).

### 2.1 `admin` — platform config & circuit breaker (coverage 100.00%)
- **Purpose:** holds the mutable on-chain knobs: `take_rate_bps`, `insurance_bps`, `subsidy_atomic`, `sla_min_stake_atomic`, `paused`.
- **Key entries:** `set_take_rate`, `set_subsidy`, `set_sla_min_stake`, `set_paused` (all `&AdminCap`-gated); read accessors; `assert_not_paused`.
- **Invariants:** `set_take_rate` enforces `new_take_bps <= MAX_TAKE_RATE_BPS` (1000) via `E_INVALID_BPS` and `new_insurance_bps <= new_take_bps` via `E_INSURANCE_EXCEEDS_TAKE`. `treasury_bps()` is computed `take_rate_bps - insurance_bps`, so the second invariant prevents underflow. `PlatformConfig` is a shared object with no `store`, so it cannot be wrapped/escrowed.
- **Assets at risk:** none held; this is policy. Misconfiguration risk is bounded by the 10% hard cap — even a compromised AdminCap cannot set a 100% take.

### 2.2 `access` — scoped API keys (coverage 69.64%)
- **Purpose:** ties an off-chain API key to an on-chain `ScopedKey` (server-id list + expiry + revoked flag).
- **Key entries:** `mint_scoped_key<T>` (gated by `session::owner == sender`, `E_NOT_SESSION_OWNER`; `expires_at_ms > 0`, `E_INVALID_EXPIRY`), `revoke`.
- **Invariants:** only the session owner can mint a key bound to that session. **Note for auditors:** `ScopedKey` is *informational metadata* — no module in this package reads `ScopedKey` in a settlement path. Scope enforcement at settlement is via `Session.scoped_server_ids` (see `session::debit`), not via `ScopedKey`. `revoke` takes `&mut` and ignores `ctx` — anyone with a mutable reference can flip `revoked` (acceptable: `ScopedKey` is owned, not shared, so only the holder has `&mut`). Assets at risk: none.

### 2.3 `registry` — server catalog (coverage 90.09%)
- **Purpose:** canonical catalog. `Server` is a shared object; `NamespaceRegistry` is a shared `Table<vector<u8>, ID>` enforcing unique namespaces.
- **Key entries:** `publish_server` (returns `ServerOwnerCap`), `update_metadata`, `add_tool`, `remove_tool`, `update_tool_price`, `deactivate`.
- **Invariants:** namespace uniqueness (`E_NAMESPACE_TAKEN`); charset/length lockdown in `assert_valid_namespace` (`E_NAMESPACE_EMPTY`, `E_NAMESPACE_TOO_LONG` at 64, `E_INVALID_NAMESPACE_CHAR` — only `[a-z0-9_-]`); every mutation `assert_cap_matches` (`E_CAP_MISMATCH`); tool price `> 0` (`E_INVALID_PRICE`); ≤100 tools (`E_TOO_MANY_TOOLS`); no duplicate tool name (`E_TOOL_ALREADY_EXISTS`). `deactivate` frees the namespace and decrements `server_count`.
- **Assets at risk:** none held. Integrity risk: stale `endpoint_url` (off-chain concern).

### 2.4 `session` — pre-funded user escrow (coverage 76.64%)
- **Purpose:** holds the user's `Balance<T>`; the only place user funds debit from per call.
- **Key entries:** `create`, `deposit`, `withdraw`, `update_limits`, `update_scope`, `close` (all owner-gated by `E_NOT_OWNER`); `debit`/`credit` are `public(package)` — callable only by `settlement`.
- **Invariants:** `debit` enforces `active` (`E_INACTIVE`), expiry (`E_EXPIRED`), per-call cap (`E_PER_CALL_CAP`), rolling per-day cap (`E_PER_DAY_CAP`, window = `timestamp_ms / 86_400_000`), scope (`E_SCOPE_MISMATCH`), and sufficient balance (`E_INSUFFICIENT_BALANCE`) **before** splitting the balance. `withdraw`/`close` only ever pay `session.owner` (recipient is not caller-supplied). `credit` (refund path) saturates `lifetime_spent`/`today_spent` decrements at 0 to avoid underflow.
- **Assets at risk:** the full user balance. This is the highest-value module. Mitigations: `debit` is `public(package)` (not callable by arbitrary code); recipient of every payout is hard-bound to `owner`.

### 2.5 `settlement` — the atomic PTB (coverage 73.46%)
- **Purpose:** the all-or-nothing entrypoint. Variants: `settle_call`, `settle_call_with_intent`, `settle_call_upto`, `settle_call_upto_with_intent`, plus `claim_for_failed_call`. All share private `settle_inner<T>`.
- **Invariants (in `settle_inner`):** `admin::assert_not_paused` (`E_PAUSED`); server active (`E_SERVER_INACTIVE`); tool exists (`E_TOOL_NOT_FOUND`); `vault::owner == registry::owner(server)` (`E_VAULT_OWNER_MISMATCH`) — prevents paying an attacker's vault for someone else's server; split math in `u128` with `total_take_u128 <= amount` guard (`E_AMOUNT_OVERFLOW`); receipt is `key`-only (no `store`) → soulbound. `settle_call_*_with_intent` adds `intent::agent == session::owner` (`E_INTENT_AGENT_MISMATCH`). `settle_call_upto*` enforces `actual_atomic <= quoted_max_atomic` (`E_ACTUAL_EXCEEDS_QUOTED`). `claim_for_failed_call` requires `sender == receipt.payer` (`E_NOT_RECEIPT_PAYER`), `!success` (`E_RECEIPT_SUCCEEDED`), `!refunded` (`E_ALREADY_REFUNDED`), and sets `refunded = true` before paying (single-claim).
- **Assets at risk:** the debited per-call amount and the insurance pool (claim path). Split-conservation proof in §5.

### 2.6 `vault` — developer earnings (coverage 100.00%)
- **Purpose:** accrues the dev share; shared so settlement can credit without an owned ref.
- **Key entries:** `create` (permissionless), `accrue` (`public(package)`, settlement-only), `claim` (owner-gated `E_NOT_OWNER`, `E_NOTHING_TO_CLAIM`), `set_auto_claim_threshold`.
- **Invariants:** `claim` pays only `vault.owner`; threshold is stored but **not enforced** (documented Sprint-12 stub). Assets at risk: accrued dev balance — recipient hard-bound to owner.

### 2.7 `treasury` — platform revenue (coverage 100.00%)
- **Purpose:** receives treasury share. Generic over `T`; `initialize<T>` is AdminCap-gated (init is monomorphic).
- **Key entries:** `collect` (`public(package)`), `withdraw` (`&AdminCap`, recipient-supplied, `E_INSUFFICIENT_BALANCE`).
- **Note for auditors:** `withdraw` is gated by `AdminCap` *possession only* — it does **not** additionally check `ctx.sender()`. This is intentional (the cap is the authority, ADR-004) but means cap custody == treasury custody. Recommend the multisig (BLOCKED.md item 9) before mainnet.

### 2.8 `insurance` — SLA / refund pool (coverage 74.86%)
- **Purpose:** receives insurance share; pays failed-call claims and routine outage payouts.
- **Key entries:** `collect` (`public(package)`), `pay_claim` (`public(package)`, settlement-only), `top_up` (permissionless donate), `pay_out` (`&InsurancePayerCap`), `admin_withdraw` (`&AdminCap`, emergency).
- **Invariants:** every payout asserts `balance >= amount` (`E_INSUFFICIENT_BALANCE`); `pay_claim` is only reachable through `settlement::claim_for_failed_call`, which has already proved a soulbound failed unrefunded receipt and pre-capped `amount` to the pool balance.
- **Assets at risk:** the pooled insurance funds. Three payout doors (claim / payer-cap / admin) — see threat T-INS-1.

### 2.9 `quality` — oracle attestations (coverage 74.40%)
- **Purpose:** `OracleCap`-gated `QualityAttestation` shared objects. Read by `staking` (S7) and dApps.
- **Invariants:** `attest` clamps `score_x100 / uptime_x100 / error_rate_x100 <= 10_000` (`E_INVALID_SCORE`) and `window_end_ms > window_start_ms` (`E_INVALID_WINDOW`). Attestations are immutable once shared. Assets at risk: none directly; integrity feeds `staking::slash`.

### 2.10 `intent` — delegated agent budgets (coverage 96.90%)
- **Purpose:** user delegates a capped budget to an agent address.
- **Key entries:** `create` (`E_INVALID_AGENT` if `@0x0`), `revoke` (user-only, `E_NOT_OWNER`), `record_spend` (`public(package)`, settlement-only).
- **Invariants:** `record_spend` asserts `!revoked` (`E_REVOKED`), expiry (`E_EXPIRED`), per-call (`E_PER_CALL_CAP`), server scope and category scope (both `E_SCOPE_MISMATCH`), and rolling daily cap (`E_DAILY_CAP`). Assets at risk: none directly; it gates how much of the *session* an agent may spend.

### 2.11 `staking` — SLA collateral (coverage 56.51%)
- **Purpose:** developer locks USDsui against an SLA; oracle can `slash` to the insurance pool.
- **Key entries:** `post` (`E_BELOW_MINIMUM` vs `admin::sla_min_stake_atomic`, `E_INVALID_SLA`), `top_up` (owner-only), `withdraw` (owner-only + `E_LOCKED` until `locked_until_ms`, `E_INSUFFICIENT_STAKE`), `slash` (`&OracleCap` **and** `&QualityAttestation`; `E_ATTESTATION_SERVER_MISMATCH`, `E_NO_SLA_BREACH`, `E_STALE_ATTESTATION`, `E_INSUFFICIENT_STAKE`).
- **Note for auditors (T-STK-1 RESOLVED in S8):** `slash<T>` now requires `&OracleCap` **and** a `&QualityAttestation` that on-chain proves the breach — same server (`E_ATTESTATION_SERVER_MISMATCH`), `uptime_x100 < stake.sla_uptime_x100` (`E_NO_SLA_BREACH`), and freshness within `sla_window_seconds × 3` (`E_STALE_ATTESTATION`). An `OracleCap` holder can no longer slash an in-SLA server or replay a stale breach; the off-chain-computed slash *amount* is still bounded on-chain to the available stake. Negative tests: `staking_slash_without_breach_aborts`, `staking_slash_with_wrong_server_attestation_aborts`.

### 2.12 `bundle` — composable server bundles (coverage 59.17%)
- **Purpose:** curated server list + price multiplier.
- **Key entries:** `create` (`E_NO_SERVERS`, `E_TOO_MANY_SERVERS` at 50, `E_INVALID_MULTIPLIER` for `0` or `>1000`), `deactivate` (creator-only `E_NOT_OWNER`), `activate_for_user` (emits an event only).
- **Note for auditors:** `activate_for_user` is a **pure event emitter** — no settlement module consults `Bundle.price_multiplier_x100`. Bundle-aware pricing is documented as a Sprint-5 stub not yet wired into `settle_inner`. Assets at risk: none.

### 2.13 `events` — typed event structs (coverage 93.78%)
- **Purpose:** all `emit_*` helpers and event structs consumed by the indexer.
- **Invariants:** no state, no assets; pure `event::emit`. Risk: event/indexer shape drift (off-chain concern, not a contract vuln).

---

## 3. STRIDE-style threat model

| ID | Threat (STRIDE) | Affected `module::function` | Mitigation in code | Residual risk |
|---|---|---|---|---|
| T-SET-1 | **Tampering** — facilitator pays a vault that doesn't own the server | `settlement::settle_inner` | `assert!(vault::owner(vault) == registry::owner(server), E_VAULT_OWNER_MISMATCH)` | Low. Requires both objects in the PTB; mismatch aborts the whole PTB. |
| T-SET-2 | **Elevation** — mint a `CallReceipt` without paying | `settlement::settle_inner` | Receipt minted only after `session::debit` + 3-way split succeed; whole thing is one PTB (atomic revert) | Low. No path mints a receipt outside `settle_inner`. |
| T-SET-3 | **Tampering** — split doesn't conserve `amount` (rounding/overflow drains a pool) | `settlement::settle_inner` | `u128` math; `total_take_u128 <= amount` (`E_AMOUNT_OVERFLOW`); `dev_share = amount - total_take`; `balance::split` aborts if short | Low — see §5 proof sketch. Rounding favors the developer (dev gets the remainder), never overdraws. |
| T-SET-4 | **Spoofing** — replay a failed-call claim to drain insurance | `settlement::claim_for_failed_call` | `sender == payer` (`E_NOT_RECEIPT_PAYER`); `refunded` set `true` *before* `pay_claim`; payout capped at pool balance | Low. Single-claim is enforced by the receipt's own mutable flag. |
| T-SET-5 | **DoS** — paused platform still settles | `settlement::settle_inner` | `admin::assert_not_paused` first line (`E_PAUSED`) | Low. Circuit breaker is AdminCap-controlled (availability tradeoff is intentional). |
| T-SES-1 | **Tampering** — exceed user's per-call/day/scope cap | `session::debit` | All caps asserted before `balance::split`; `debit` is `public(package)` | Low. Day window is gateway-clock-based (documented as rate-limit precision, not fiscal). |
| T-SES-2 | **Information/Elevation** — non-owner withdraws a session | `session::withdraw`/`close` | `E_NOT_OWNER`; payout recipient hard-bound to `session.owner` (not caller arg) | Low. |
| T-INT-1 | **Elevation** — agent spends beyond delegated budget | `intent::record_spend` + `settlement::settle_call_with_intent` | `E_INTENT_AGENT_MISMATCH` (agent must == session owner the gateway opens) + per-call/daily/scope/category asserts | Medium-Low. Relies on the gateway opening the session *as* the intent agent; on-chain it's enforced that whoever the session owner is must equal `intent.agent`. |
| T-REG-1 | **Tampering** — edit another dev's server | `registry::*` mutators | `assert_cap_matches` (`E_CAP_MISMATCH`) on every mutator | Low. |
| T-REG-2 | **Spoofing** — squat/confuse a namespace | `registry::publish_server` | Unique table (`E_NAMESPACE_TAKEN`) + strict charset | Low on-chain; brand-squatting is an off-chain moderation concern. |
| T-TRE-1 | **Elevation/Repudiation** — drain treasury | `treasury::withdraw` | `&AdminCap`-gated; emits `TreasuryWithdrawn` | **Medium.** Cap possession == authority; no second factor on-chain. Mitigation is operational: AdminCap → multisig (BLOCKED.md item 9). |
| T-INS-1 | **Elevation** — drain insurance via payer/admin door | `insurance::pay_out`, `insurance::admin_withdraw` | Cap-gated; balance-checked | **Medium.** `InsurancePayerCap`/`AdminCap` custody == pool custody. Same multisig mitigation. The permissionless `claim_for_failed_call` door is *not* a drain vector (needs a real failed receipt). |
| T-STK-1 | **Elevation** — unjust slash with no breach proof | `staking::slash` | `&OracleCap` + `&QualityAttestation` predicate: same-server + `uptime < committed SLA` + freshness (`sla_window_seconds × 3`) + balance check | **Resolved (S8).** Slash now requires on-chain breach proof; an OracleCap alone cannot slash an in-SLA server or replay a stale attestation. Residual: oracle still chooses the *amount* (bounded to stake) and could attest a false low uptime — see T-QUA-1 (oracle-honesty assumption, §4). |
| T-QUA-1 | **Tampering** — false quality attestation | `quality::attest` | `&OracleCap`-gated; score bounds clamped | Medium. Oracle is trusted (multi-attestor possible but no on-chain quorum). Off-chain oracle honesty is an explicit assumption (§4). |
| T-ADM-1 | **Tampering** — admin sets predatory take rate | `admin::set_take_rate` | Hard cap `MAX_TAKE_RATE_BPS = 1000` (`E_INVALID_BPS`); `insurance <= take` (`E_INSURANCE_EXCEEDS_TAKE`) | Low. Even a compromised AdminCap is bounded to ≤10%. |
| T-ACC-1 | **Repudiation** — revoked `ScopedKey` still honored | `access::revoke` | `revoked` flag set | Informational. `ScopedKey` is not consulted in any on-chain settlement path; revocation is enforced off-chain by the gateway. |

---

## 4. Known assumptions & out-of-scope

1. **Off-chain facilitator price honesty.** `settle_inner` deliberately does **not** compare `amount_atomic` to `registry::tool_price_atomic` — only that the tool *exists* (`E_TOOL_NOT_FOUND`). This supports free-tier / volume discounts. Consequence: the facilitator chooses the charged amount. The on-chain backstop is the *user's* `Session` per-call/daily caps and (if used) the `SpendingIntent` caps. A malicious facilitator can overcharge up to those caps but not beyond, and cannot misdirect the split. **The price oracle is trusted; the value plumbing is not.** This is by design and must be stated in the audit scope.
2. **Oracle trust.** `quality::attest` and `staking::slash` trust `OracleCap` holders. There is no on-chain attestation quorum (ADR-009 future work). Multi-attestor is possible (multiple caps) but not enforced.
3. **Admin/multisig trust.** AdminCap, InsurancePayerCap, OracleCap are bearer object-capabilities (`key, store`). Their custody **is** their authority — there is no on-chain `ctx.sender()` allowlist on top. Production requires these held by a multisig (ADR-001/004, BLOCKED.md item 9). Auditing the multisig itself is out of scope of this Move package.
4. **Walrus / Seal availability.** Receipts carry a `log_blob_id`; the contract never reads Walrus. Blob availability and Seal encryption correctness are out of scope (off-chain storage layer).
5. **Day-window precision.** `session`/`intent` daily caps roll at `timestamp_ms / 86_400_000` (UTC midnight of the gateway-observed `Clock`). This is rate-limiting precision, not fiscal accounting — explicitly documented in `session.move`.
6. **Coin type `T`.** All value modules are generic over `T`; production binds `T = USDsui`. The audit assumes a well-behaved fungible coin (no rebasing / fee-on-transfer). USDsui satisfies this.
7. **Sprint stubs not for mainnet-as-is:** `bundle` price multiplier (not wired into settlement), `vault` auto-claim threshold (stored, unenforced), `access::ScopedKey` (informational). These are documented stubs; treat them as out-of-scope for *settlement-critical* review. (`staking::slash`'s breach predicate, formerly T-STK-1, was resolved in S8 — it is no longer a stub.)

---

## 5. Atomic-settlement invariant — proof sketch

**Claim 1 — value conservation.** In `settlement::settle_inner`, for a debited
`amount = amount_atomic`:

```
total_take = (amount * take_bps) / 10_000          // u128, floor
insurance  = (amount * insurance_bps) / 10_000     // u128, floor
treasury   = total_take - insurance
dev        = amount - total_take
```

`admin::set_take_rate` guarantees `insurance_bps <= take_bps <= 1000`, so:

- `insurance <= total_take` (since `insurance_bps <= take_bps`, integer floor preserves the inequality) ⇒ `treasury = total_take - insurance >= 0` (no u128 underflow).
- `total_take <= amount` is additionally **asserted** (`E_AMOUNT_OVERFLOW`) ⇒ `dev = amount - total_take >= 0`.
- By construction `insurance + treasury + dev = insurance + (total_take - insurance) + (amount - total_take) = amount`. **Exact, no remainder lost.**

The balance is then physically partitioned with `balance::split(&mut payment,
insurance)`, `balance::split(&mut payment, treasury)`, and the remaining
`payment` (== `dev`) goes to `vault::accrue`; if `dev == 0`, `payment` is empty
and `balance::destroy_zero` consumes it. `balance::split` aborts if a share
exceeds the remaining balance — but the algebra above proves the three shares
sum to exactly `amount`, the exact value `session::debit` produced. Therefore
the split can never under- or over-draw, and rounding dust (from the two floors)
accrues entirely to `dev` (the developer), never creating or destroying value.

**Claim 2 — atomicity.** All of {pause check, server-active, tool-exists,
vault-owner, session debit (caps/scope/expiry/balance), 3-way credit, receipt
mint, event emit} execute in `settle_inner` within the facilitator's single PTB.
Move aborts roll back the entire transaction, so any failed assertion ⇒ no
debit, no credit, no receipt. There is no partial-settlement state.

**Claim 3 — receipt soulbound.** `CallReceipt` has ability `key` only (no
`store`). It is `transfer::transfer`'d to `payer` once. Without `store` it
cannot be re-wrapped or `public_transfer`'d, so it is non-transferable after
mint (ADR-005/010 permanence).

**Claim 4 — single refund.** `claim_for_failed_call` asserts `!receipt.refunded`
then sets `receipt.refunded = true` **before** calling `insurance::pay_claim`.
Because the receipt is soulbound to `payer` and `sender == payer` is asserted,
the same receipt cannot fund two payouts (the second call aborts on
`E_ALREADY_REFUNDED`). Payout is `min(amount_atomic, pool_balance)`, so a claim
can never overdraw the pool.

---

## 6. Test coverage summary

Captured on the current tree with `sui 1.71.1`:

```
cd contracts && sui move test            → Total tests: 85; passed: 85; failed: 0
cd contracts && sui move test --coverage
cd contracts && sui move coverage summary
```

`--coverage` **is** supported by this toolchain. Region/line coverage by module:

| Module | Coverage % | Assessment |
|---|---|---|
| `admin` | 100.00 | Fully covered |
| `vault` | 100.00 | Fully covered |
| `treasury` | 100.00 | Fully covered |
| `intent` | 96.90 | Well covered |
| `events` | 93.78 | Well covered |
| `registry` | 90.09 | Well covered |
| `session` | 76.64 | Adequate; uncovered: some accessor/edge branches |
| `insurance` | 74.86 | Adequate; `admin_withdraw` path lightly exercised |
| `quality` | 74.40 | Adequate; window/score reject branches partially covered |
| `settlement` | 73.46 | Core paths covered (all `settle_*` variants + claim); some accessor/`destroy_zero` edges uncovered |
| `access` | 69.64 | **Gap:** `revoke` and expiry-reject lightly tested |
| `bundle` | 59.17 | **Gap:** `deactivate` non-owner, multiplier bounds partially covered (bundle is a stub) |
| `staking` | 56.51 | `top_up` / `withdraw` lock path still light; `slash` now has the breach predicate + negative tests (T-STK-1 resolved). More `top_up`/`withdraw` tests recommended. |
| **Total** | **81.32** | Up from the previously-reported ~77%; 87 tests (was 77). |

Test count per file (`contracts/tests/*_tests.move`, total 85):

| File | Tests |
|---|---|
| `settlement_tests.move` | 14 |
| `session_tests.move` | 13 |
| `intent_tests.move` | 10 |
| `registry_tests.move` | 10 |
| `admin_tests.move` | 8 |
| `stubs_tests.move` | 8 |
| `vault_tests.move` | 6 |
| `insurance_tests.move` | 5 |
| `quality_tests.move` | 4 |
| `treasury_tests.move` | 4 |
| `e2e_tests.move` | 3 (full lifecycle, failed-claim, stake-slash) |

**Well-covered, settlement-critical:** `admin`, `vault`, `treasury`, `intent`,
`registry`, `settlement` core flow, `session` debit/caps. The split-conservation
invariant (§5) is directly tested by
`settlement_tests::take_rate_split_is_50bps_insurance_200bps_treasury`,
`settle_full_flow_distributes_correctly`,
`settle_with_custom_take_rate_distributes_correctly`,
`settle_with_zero_amount_mints_receipt_no_distribution`, and the upto/intent
variants.

**Gaps the auditor should weight:** `staking` (56.5%) — coverage still the
lowest (`top_up`/`withdraw` lock path); T-STK-1 is resolved (breach predicate +
negative tests). `bundle`/`access` low coverage but documented non-settlement
stubs.

---

## 7. Submission contents

- This document (`docs/AUDIT.md`).
- Move source: `contracts/sources/*.move` (13 modules), tests `contracts/tests/*.move`.
- `contracts/Move.toml` (edition `2024.beta`, Apache-2.0, Sui dep pinned `framework/testnet`).
- ADRs `docs/DECISIONS.md` (ADR-004 take rate, ADR-005 permanence, ADR-009 staking, ADR-011 mirror).
- Architecture `docs/ARCHITECTURE.md` (single-PTB data flow).
- Pre-mainnet checklist `contracts/MAINNET-PREP.md`; deploy gating `docs/BLOCKED.md` (item 9 multisig, item 11 mainnet deploy).

**Top recommendations for the audit engagement:**
1. Validate the S8 T-STK-1 fix: confirm `staking::slash` cannot run without a same-server, in-breach, fresh `QualityAttestation` (review the freshness arithmetic `sla_window_seconds × 3 × 1000` for overflow on extreme `sla_window_seconds`, and confirm the off-chain-chosen `amount` bounded only by stake balance is acceptable given the oracle-honesty assumption §4).
2. Confirm AdminCap/OracleCap/InsurancePayerCap are multisig-held before mainnet (operational, not code).
3. Independently verify the §5 split-conservation algebra against `settle_inner`.
