# CLAUDE.md — MCPX project context for AI sessions

You are working in the **mcpxgg** monorepo: the Sui-native rebuild of mcpx.gg, an on-chain MCP marketplace.

## What MCPX is

A marketplace + gateway + x402 facilitator for MCP servers, where every tool call settles on-chain in USDsui, every receipt is on Walrus, and developers earn directly to their Sui wallet.

## Active milestone

Mainnet by **June 21, 2026** (hackathon target). Demo Day **July 20–21, 2026**.

## How to navigate

- **Sprint plan:** `docs/SPRINTS.md` — single source of truth for all work, with sub-tasks IDed `S<sprint>-T<task>` for tracking.
- **Decisions:** `docs/DECISIONS.md` — locked-in choices. Don't relitigate without writing a new ADR.
- **Architecture:** `docs/ARCHITECTURE.md`
- **Reuse map:** `docs/REUSE-MAP.md` — what was carried from the Web2 build, what was deliberately not.
- **Features ledger:** `docs/FEATURES.md` — all 19 platform additions (Tier A/B/C) with sprint assignments.
- **Spec:** the canonical spec is `MCPX-SUI-SPEC.md` in the prior `mcpx/` working dir. Don't duplicate it here.

## Tech stack

- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui
- **Auth:** Privy (wallet + social login: Google, email, Apple, Discord, Twitter, plus external Sui wallets)
- **Database:** Supabase Postgres — used as an **indexer mirror only**, never the source of truth
- **Cache:** Upstash Redis — gateway auth + indexer pub/sub
- **On-chain:** Sui Move package with modules registry, session, settlement, vault, treasury, access, quality, intent, staking, insurance, bundle
- **Payments:** USDsui via x402-spec facilitator
- **Storage:** Walrus (permanent retention for all receipts) + Seal for at-rest encryption
- **Hosting:** Vercel for web + docs; Fly.io / Railway for gateway, facilitator, indexer
- **Package manager:** pnpm with Turborepo
- **Languages:** TypeScript (strict) for services + frontend, Move for contracts

## Operating principles

- **Multi-chain ready, Sui-only today.** Every chain-touching call goes through `packages/chain` (`ChainAdapter` interface). Adding Base/Solana later is purely additive.
- **Indexer mirror, not source of truth.** Postgres is read-fast UI cache; the chain owns state. Reads go to Postgres; writes sign Move txs.
- **Atomic settlement in a single PTB.** Debit session → credit dev vault → credit treasury → credit insurance → mint receipt. All-or-nothing.
- **Permanent receipts.** Every CallReceipt and the Walrus blob it points to are permanent. Compose with future trust primitives.
- **Take rate is on-chain configurable.** Default 2.5% (0.5% insurance, 2.0% treasury). Stored in `PlatformConfig` shared object, mutable via admin multisig.
- **No tokens.** Stablecoin revenue from day one. Optional governance token only post-launch with clear utility.

## Codebase rules

- Don't introduce `lib/billing/razorpay.ts` patterns. Razorpay/Stripe are deliberately out — see REUSE-MAP.md.
- Don't add credit-cost integers (`1|3|10`). Pricing is `priceAtomic: bigint` in USDsui smallest unit (6 decimals).
- Don't hard-code chain IDs. Use `getActiveChain()` from `packages/chain`.
- Don't write to Postgres tables that should be hydrated by the indexer. If you find yourself writing `mcp_servers` from a route handler, it's wrong — emit a Move event, indexer writes.
- Don't bypass the facilitator. The gateway never directly signs settlement transactions — it always goes through `/settle`.
- Always update `docs/SPRINTS.md` as tasks complete. Mark `Status` to `Done`.

## Where to put new code

- New Move module → `contracts/sources/<name>.move`
- New chain operation → `packages/chain/src/sui-adapter.ts` (and add to `ChainAdapter` interface)
- New page on mcpx.gg → `apps/web/app/...`
- New shared component → `packages/ui/src/...`
- New first-party MCP server → `servers/<name>/` with its own `package.json`
- New indexer event handler → `apps/indexer/src/handlers/`
- New facilitator scheme → `apps/facilitator/src/schemes/`

## Don't be precious — but don't be sloppy either

This is a real product, not a hackathon throwaway. Tests for every Move module. E2E test for every user flow. Every PR ships green CI. But also: don't bikeshed; ship the simplest thing that meets the DoD, optimize when measured.

---

## Session Context (Last updated: 2026-05-18 00:10)

### Current State
- **Sprints 0–7 complete on branch `claude/modest-swartz-dcdccc`.** Two S7 commits: `17b0b49` (part 1), `7023220` (part 2). NOT yet pushed/merged to `origin/main` (remote still at `7c003f8` S6). Next session: push this branch + fast-forward `main`.
- Verification all green: `sui move test` **85/85**, `pnpm turbo run typecheck` **28/28**, `pnpm turbo run test` **26/26**, `pnpm --filter @mcpxgg/web build` ✓.
- **Sprint 7 shipped all 26 tasks** (docs/SPRINTS.md S7 table all `Done`). A2 pay-per-output streaming, A3 SLA staking + auto-slash, A4 insurance pool + claims, A6 embeddable widget. Plus 2 new E2E lifecycles + indexer wiring.
- **S6-T10/T13 still the only blocked items** (mainnet deploy of walrus-store/sui-identity) — BLOCKED.md item 11, mainnet keystore, not code. Don't retry.
- ⚠️ Local `main` (primary worktree) still at S5 `32db015`; remote at S6 `7c003f8`; this branch is S7. Sync chain: push branch → ff `main`.

### Recent Changes (Sprint 7, commits 17b0b49 + 7023220)
- **Contracts:** `settlement::settle_call_upto[_with_intent]<T>` (meters actual ≤ quoted max, implicit refund of unused delta); `settlement::claim_for_failed_call<T>` (soulbound-receipt payer reclaims failed-call cost from InsurancePool, once, capped at pool bal); `insurance::pay_claim` pkg fn; `events::UptoFinalized`; explicit 50/200 bps split test. staking `post/top_up/withdraw/slash` were already complete (S1-expanded). 85/85 Move tests (settlement_tests + e2e_tests extended).
- **packages/chain:** `buildPostStakeTx/buildTopUpStakeTx/buildWithdrawStakeTx/buildSlashStakeTx/buildClaimFailedCallTx/buildTopUpInsuranceTx` + `SLA_TIER_UPTIME_X100`.
- **A2:** `@mcpxgg/x402` `upto` scheme types+wire; facilitator scheme dispatch + upto PTB branches; gateway SSE detection + `StreamMeter` finalize-on-close (handles abort); `@mcpxgg/server` async-iterator handlers (back-compat). Streaming E2E in `apps/gateway/src/stream.test.ts`.
- **A3:** `apps/quality-oracle` SLA compliance + auto-slash after ≥2 breach windows (slash ∝ uptime shortfall vs *committed* tier, capped); `apps/web` StakingFlow + /api/stakes + StakeBadge + marketplace "Staked" filter; migration `014_sla_breach_streaks.sql` (oracle-owned, NOT mirror).
- **A4:** `apps/web` ClaimRefundButton on receipts (usage list + receipt detail) + /api/receipts/claim-refund; public `/insurance` dashboard; admin top-up; migration `016_insurance_pool.sql` (request_log refund cols + insurance_payouts/contributions mirrors + top_contributors view).
- **A6:** new `packages/widget` (`@mcpxgg/widget`) zero-framework `<mcpx-call>` Web Component (Shadow DOM, CSS-var theming, Privy→bare-wallet fallback, reuses @mcpxgg/sdk); tsc ESM + esbuild IIFE/ESM CDN bundles; `apps/docs` embed page; landing + marketplace embeds; one-click third-party demo HTML. 24 tests.
- **Indexer:** `handleUptoFinalized` + `finalizeUpto` storage (migration `015_upto_finalization.sql`, request_log quoted/actual/unused cols); `markRequestRefunded` now also writes migration-016 refund columns + idempotent `insurance_payouts` row (claim works end-to-end). 54 indexer tests.

### Next Steps
1. **Push `claude/modest-swartz-dcdccc` and fast-forward `origin/main`** (remote is 2 sprints behind: S6 → S7). Check the GitHub CI workflow runs green on push.
2. Sync local `main` in primary worktree (`git pull --ff-only`).
3. **Sprint 8** (`docs/SPRINTS.md` ~line 586, "Migration + Audit Prep + Demo Day", July 13–19): web2→Sui migration script, OtterSec audit submission, docs.mcpx.gg site, landing/marketing refactor, loadtest, Demo Day prep. Read the S8 sub-task table first.
4. S6-T10/T13 stay blocked (mainnet keystore, BLOCKED.md item 11). BLOCKED.md item 1 (Sui keystore + testnet deploy) remains the top unblock.

### Key Decisions
- **Contracts + packages/chain as dependency root:** did both foreground first (small, shared), then briefed 5 parallel agents with finalized Move/builder signatures — same proven S6 pattern, avoids cross-agent shape races.
- **`settle_call_upto` = thin wrapper over `settle_inner`:** debits only `actual_atomic`; the x402 "refund delta" is *implicit* (never debited) — no escrow/refund coin path needed. Cleaner + correct.
- **`claim_for_failed_call` is permissionless, gated by the soulbound receipt itself** (success==false && !refunded, sender==payer). The receipt *is* the proof — no oracle/cap. `refunded` flag makes it single-claim.
- **Slash formula:** `shortfall = clamp((committedX100 − actualX100)/committedX100,0,1)`; `slash = round(remainingStake × shortfall)`, capped; only after ≥2 consecutive in-breach windows; zero-call windows = no-signal (streak unchanged).
- **Migration 015 collision** (insurance vs upto, both agents): renamed insurance → `016`; both only ALTER request_log with disjoint columns so order-agnostic.
- **`insurance_top_contributors` stays empty by design:** on-chain `InsuranceCollected` carries no contributor address, so named attribution isn't event-derivable today; page degrades gracefully (documented, not a TODO).
- **`stakes`/`stake_slashes` are the migration-007 mirror** the existing indexer staking handler already writes; migration-011 `server_stakes` is unused scaffold — deliberately not used.

### Previous Session Notes
- **S6 (2026-05-17):** spending intents end-to-end, quality oracle, anchors #4/#5, /live, abuse detection (commit 7c003f8). **S1 (2026-05-10):** 13 Move modules + atomic settlement + chain mirror + 65 tests. Pre-S6: S0 scaffold → S1 contracts → S2 facilitator+indexer → S3 chain gateway+SDK → S4 Privy+chain+marketplace → S5 anchors #2/#3+CLI+bundles → S6 intents+oracle+anchors#4/5 → S7 streaming+staking+insurance+widget.
