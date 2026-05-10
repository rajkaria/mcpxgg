# Reuse Map — Web2 MCPX → mcpxgg

What was carried over from the prior `mcpx/` Web2 build, what was deliberately not, and where each carried piece now lives.

The legacy build sat at `Projects/mcpx/`. Files were copied from the worktree branch `claude/strange-lamport-a062e5`.

---

## Carried over verbatim (lift, minor adapt)

| Old path (mcpx/) | New path (mcpxgg/) | Notes |
|---|---|---|
| `app/(auth)/*` | `apps/web/app/(auth)/` | Privy replaces password / magic-link as primary; existing Supabase Auth pages kept as fallback |
| `app/marketplace/*` | `apps/web/app/marketplace/` | Reads from indexer-mirrored Postgres; rendering unchanged |
| `app/dashboard/{settings,usage,verify-phone,servers}/*` | `apps/web/app/dashboard/...` | Usage rows will get `tx_digest` and `receipt_blob_id` columns |
| `app/about`, `app/pricing`, `app/developers` | `apps/web/app/` | Copy update only: "USDsui" replaces "credits", "wallet" replaces "subscription" |
| `app/page.tsx` | `apps/web/app/page.tsx` | Hero copy update; live ticker added in Sprint 4 |
| `app/api/auth/regenerate-key` | `apps/web/app/api/auth/regenerate-key` | Key still rotates; rebound to existing on-chain Session |
| `app/api/marketplace/{search,reviews}` | `apps/web/app/api/marketplace/` | Backed by indexer-mirrored Postgres |
| `app/api/mcp` | `apps/web/app/api/mcp` (or moved to apps/gateway) | Gateway split happens in Sprint 3 |
| `app/api/phone/*` | `apps/web/app/api/phone/` | Used for sybil resistance on bootstrap subsidy |
| `app/layout.tsx`, `globals.css`, `middleware.ts` | `apps/web/...` | Wrap with PrivyProvider in Sprint 4 |
| `components/auth/*` | `apps/web/components/auth/` | Add `<PrivyConnect />` replacing Supabase login UI |
| `components/dashboard/*` | `apps/web/components/dashboard/` | `<CreditBalance />` becomes `<SessionBalance />` showing USDsui |
| `components/ui/*` | `apps/web/components/ui/` (will be moved to `packages/ui` in Sprint 0) | shadcn primitives; no logic changes |
| `lib/supabase/*` | `apps/web/lib/supabase/` (and `packages/shared/src/supabase/` post Sprint 0 refactor) | Server, client, admin, middleware — unchanged |
| `lib/cache/*` | `apps/web/lib/cache/` (and `packages/shared/src/cache/`) | Upstash Redis client unchanged |
| `lib/twilio/*` | `apps/web/lib/twilio/` (and `packages/shared/src/twilio/`) | Phone verification — used for bootstrap subsidy |
| `lib/utils/*` | `apps/web/lib/utils/` (and `packages/shared/src/utils/`) | API key gen utility unchanged |
| `lib/validation/config-schema.ts` | `apps/web/lib/validation/` (and `packages/shared/src/validation/`) | `creditCost: 1\|3\|10` enum becomes `priceAtomic: bigint` in Sprint 5 |
| `lib/gateway/*` | `apps/gateway/src/gateway/` | Dispatch shape unchanged; `debitCredits/refundCredits` swapped for chain-adapter calls in Sprint 3 |
| `lib/mcp-servers/*` | `apps/gateway/src/mcp-servers/` | Internal handler registry — minimally touched |
| `supabase/migrations/001-005` | `supabase/migrations/` | Re-applied; Sprint 1 adds `006_chain_columns.sql` (chain_id, object_id, tx_digest, receipt_blob_id, chain_balances, developer_vaults) |
| `starter-template/*` | `starter-template/` | Sprint 5 adds `@mcpxgg/server` dependency + Sui pricing examples |

---

## Deliberately not carried over (replaced or deferred)

| Old path | Why excluded | Replaced by |
|---|---|---|
| `lib/billing/razorpay.ts` | Razorpay rails replaced by USDsui Sessions | `packages/chain/src/sui-adapter.ts` + `apps/facilitator/` |
| `lib/billing/stripe.ts` | Already legacy in old build | — |
| `lib/billing/credits.ts` | Replaced by `mcpx::settlement::settle_call` PTB | Off-chain ledger view hydrated from `CallSettled` events by indexer |
| `lib/billing/plans.ts` | Subscription plans replaced by recharge model | Per-tool free tier on Move `Tool` struct |
| `lib/cron/*` | Free-credit reset replaced by per-tool free counters | — |
| `lib/developer/payouts.ts` | Weekly Razorpay payouts replaced by on-chain claim flow | `mcpx::vault::claim` (Sprint 5) |
| `lib/developer/publishing.ts` | Publishing logic moves to CLI + Move tx | `cli/src/publish.ts` (Sprint 5) — gates pattern preserved |
| `lib/developer/analytics.ts` | DB queries replaced by indexer view queries | `apps/web/lib/analytics/` rebuild from Postgres mirror |
| `app/api/razorpay/*` | Razorpay webhooks no longer source of truth | On-chain events → indexer |
| `app/api/stripe/*` | Already legacy | — |
| `app/api/cron/*` | Replaced | — |
| `app/api/developer/*` | Will be rewritten as wallet-signed Move tx flows in Sprint 5 | — |
| `app/dashboard/billing/*` | Subscription UI replaced by recharge flow | `<RechargeFlow />` in Sprint 4 |
| `app/dashboard/developer/*` | Will be rewritten Sprint 5–6 with vault balance + claim button + chain-tx publish flow | — |
| `components/billing/*` | Subscription/topup UI replaced | New `<SessionStatus />`, `<RechargeButton />`, `<VaultBalance />`, `<ClaimButton />` components |
| `servers/{watchdog,pulse,sonar}` | Not anchor servers; fate deferred (ADR-013) | Anchor servers (`walrus-search`, `sui-defi-data`, `sui-analytics`, `walrus-store`, `sui-identity`) shipped in Sprints 3, 5, 6 |

---

## Schema migrations

| Migration | Origin | Status |
|---|---|---|
| `001_core_schema.sql` | Web2 | Re-applied as-is. `users.api_key` prefix kept (`mcpx_sk_`) |
| `002_billing_schema.sql` | Web2 | Re-applied. `credit_ledger` becomes a write-only audit ledger fed by indexer; no app code writes it |
| `003_gateway_schema.sql` | Web2 | Re-applied. Sprint 1 ALTERs to add `chain_id`, `object_id` columns |
| `004_developer_portal_schema.sql` | Web2 | Re-applied. `payouts` table becomes a read-only mirror of `VaultClaimed` events |
| `005_marketplace_schema.sql` | Web2 | Re-applied. `reviews` is read-only until Sprint 16 (on-chain reviews land) |
| `006_chain_columns.sql` | NEW (Sprint 1) | Adds chain_id/object_id/tx_digest/receipt_blob_id columns + new chain_balances + developer_vaults tables |
| `007_indexer_views.sql` | NEW (Sprint 2) | Materialized views for marketplace, dashboard, /live |
| `008_quality_attestations.sql` | NEW (Sprint 6) | Quality oracle attestation mirror |
| `009_intents_bundles_staking.sql` | NEW (Sprint 6-7) | Mirror tables for intents, bundles, SLA stakes |
| `010_reviews_onchain.sql` | NEW (Sprint 16) | Mirror for on-chain reviews |

---

## Components carried with rebinding

These components have the right layout / styling / accessibility — they get rebound to chain primitives but the JSX stays.

| Component | Rebind |
|---|---|
| `<CreditBalance />` (deleted) → `<SessionBalance />` | Reads `chain_balances.balance_atomic` instead of `users.credit_balance` |
| `<CreditHistory />` (deleted) → `<ReceiptHistory />` | Reads `request_log` joined with receipt_blob_id; renders Walrus links |
| `<TopupPacks />` (deleted) → `<RechargeFlow />` | Wallet-signed `depositToSession` instead of Razorpay checkout |
| `<PlanCard />`, `<PlanComparison />` (deleted) | Replaced by per-server pricing display |

---

## Feature parity checklist

40 items in the Web2 FEATURE-ROADMAP.md. Status mapping in mcpxgg:

| Web2 feature | Status in mcpxgg | Sprint |
|---|---|---|
| 1. SDK / CLI tool | Rebuilt as Sui-aware CLI | Sprint 5 |
| 2. Sandbox / staging mode | Same idea, on-chain via testnet `Server.active = false` | Sprint 5 |
| 3. Flexible credit pricing | Replaced by USDsui `priceAtomic` (any value) | Sprint 1 |
| 4. Usage-based pricing tiers | Achievable via Move custom pricing module | Sprint 12+ |
| 5. Webhook notifications | Same idea, indexer pushes to dev webhook on relevant events | Sprint 11 |
| 6. Server versioning | `Server.version` increments on update; old version Walrus blob preserved | Sprint 5 |
| 7. README / docs per server | Walrus `metadata_blob_id` carries full README | Sprint 5 |
| 8. Revenue calculator | `apps/web/dashboard/calculator/` reads vault accruals | Sprint 6 |
| 9. Featured placement bidding | Future — paid via USDsui to treasury | Sprint 17+ |
| 10. Multi-developer teams | Future — `ServerOwnerCap` is transferable; multi-cap via Sprint 9 org sessions | Sprint 9 |
| 11. Collections / bundles | **Composable Bundles** (Sui object groups) | Sprint 5 |
| 12. Favorites | `apps/web` user_state; off-chain | Sprint 4 |
| 13. Usage insights dashboard | Built from indexer mirror | Sprint 4 |
| 14. Credit alerts | Push notification when session balance below threshold | Sprint 6 |
| 15. Tool output history | Walrus blob viewer at `/receipts/[id]` | Sprint 4 |
| 16. Per-server API keys | `mcpx::access::ScopedKey` Move object | Sprint 9 |
| 17. Try before you enable | Demo call with treasury-funded credit | Sprint 6 |
| 18. Server request board | **On-Chain Bounty Demand Board** | Sprint 11 |
| 19. Smart recommendations | ML over `request_log`; off-chain | Sprint 14+ |
| 20. Quick setup wizard per client | `apps/web/setup` page | Sprint 4 |
| 21. Team / org accounts | **Multi-Tenant Org Sessions** | Sprint 9 |
| 22. RBAC | Sub-keys with role flags | Sprint 9 |
| 23. SSO / SAML | Privy supports enterprise SSO post-launch | Sprint 12+ |
| 24. Audit log export | CSV export of `request_log` rows + receipt blob CIDs | Sprint 4 |
| 25. IP allowlisting | Gateway-level enforcement | Sprint 9 |
| 26. Private servers | Token-gated MCP servers | Sprint 14 |
| 27. Volume discounts | Custom pricing tiers per Move pricing module | Sprint 12 |
| 28. SLA tier | **SLA staking + auto-slash** | Sprint 7 |
| 29. Usage quotas per member | On-chain via ScopedKey monthly limit | Sprint 9 |
| 30. Invoice / GST billing | Post-fiat-onramp | Future |
| 31. Affiliate / referral | Move object referral code → bonus subsidy | Sprint 11+ |
| 32. "Powered by mcpxgg" attribution | Auto-injected in `_meta` | Sprint 3 |
| 33. Platform analytics dashboard | `/live` (public) + admin views | Sprint 6 |
| 34. Blog / content marketing | `apps/docs/blog/` + ongoing | Sprint 8+ |
| 35. Changelog / what's new | `apps/docs/changelog/` | Sprint 8 |
| 36. Featured server rotation | Curation in `apps/web` admin | Sprint 6 |
| 37. Server quality score | On-chain `QualityAttestation` + SLA stake | Sprint 6 + 7 |
| 38. Abuse detection | Indexer anomaly heuristics | Sprint 6 |
| 39. Freemium conversion funnel | Bootstrap subsidy + analytics | Sprint 4 |
| 40. Developer grant program | Treasury-funded discretionary | Sprint 8+ |
