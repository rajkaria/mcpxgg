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

## Session Context (Last updated: 2026-05-17 18:41)

### Current State
- **Sprints 0–6 complete and on `origin/main`.** Remote `main` = `7c003f8` (S6). GitHub repo live: https://github.com/rajkaria/mcpxgg
- Verification all green: `sui move test` **77/77**, `pnpm turbo run typecheck` exit 0, `pnpm turbo run test` **24/24 tasks**, `pnpm --filter @mcpxgg/web build` ✓.
- **Sprint 6 shipped 24/24 code tasks.** Spending Intents (contract→indexer→gateway→SDK→UI), quality oracle service, anchor servers #4 (`walrus-store`) & #5 (`sui-identity`), Bloomberg `/live` page, abuse detection, demo-call, low-balance alert, revenue calculator, featured-rotation admin.
- **Only S6-T10 / S6-T13 remain** (mainnet deploy of the 2 new anchor servers) — blocked on mainnet keystore (see `docs/BLOCKED.md` item 11). Code/Docker/fly are deploy-ready.
- ⚠️ **Local `main` (primary worktree `/Users/rajkaria/Projects/mcpxgg`) is still at S5 (`32db015`)** — remote is ahead. Run `git pull --ff-only` there to sync (clean fast-forward, no conflicts). This worktree's branch `claude/gracious-poincare-09ddde` is pushed.

### Recent Changes (Sprint 6, commit 7c003f8 — 112 files)
- **Contracts:** `intent.move` gained `per_call_cap_atomic` + `allowed_categories`; `settlement.move` added `settle_call_with_intent<T>` via shared private `settle_inner<T>` (zero dup, `settle_call` unchanged signature); `events.move` `IntentCreated` now carries `per_call_cap_atomic`. New `contracts/tests/intent_tests.move` + extended `settlement_tests.move`/`stubs_tests.move`.
- **Indexer:** `handlers/intent.ts` + storage persist per-call cap; new `apps/indexer/src/abuse.ts` (3σ flagging) + test; `runner.ts` periodic abuse hook; `pubsub.ts` LPUSHes capped `mcpx:live:log` for SSE.
- **New `apps/quality-oracle/`** package: UTC-anchored 6h windows, score = `0.5·uptime + 0.3·(1−err) + 0.2·latency_score` (latency_score = clamp(1−p95/2000,0,1)); signs `mcpx::quality::attest` via `@mcpxgg/chain` only. 17 tests.
- **New servers:** `servers/walrus-store/` (tools upload/retrieve/metadata/list, 13 tests) + `servers/sui-identity/` (resolve_address/resolve_name/verify_zklogin/address_reputation, 17 tests). Both offline-by-default, Docker+fly deploy-ready.
- **Web (apps/web):** `app/dashboard/intents/` + `components/IntentManager.tsx`; `app/live/` (`live-terminal.tsx`, `opengraph-image.tsx`, `api/live/stream` SSE, `api/live/metrics`); `components/QualityBadge.tsx`; `components/DemoCallButton.tsx` + `api/demo-call`; `components/LowBalanceBanner.tsx` + `api/alerts/low-balance`; `components/RevenueCalculator.tsx`; `app/dashboard/admin/featured/` + `api/admin/featured` + `lib/auth/admin.ts`.
- **SDK/gateway/facilitator:** `@mcpxgg/sdk` `callTool(name,args,{intentId,category})` + `X-Mcpx-Intent-Id`/`X-Mcpx-Category` headers; new `apps/gateway/src/intent.ts` (8 `intent_*` error codes) → facilitator builds `settle_call_with_intent` PTB. `apps/docs/content/building-an-autonomous-agent.md`.
- **Migrations:** `010_quality_attestations.sql`, `011_intents_staking.sql` (intents per-call/category cols + `server_stakes` for S7 + `abuse_flags`), `012_featured_rotation.sql` (app-owned, NOT mirror), `013_intents_gateway_read.sql` (read view).
- **`packages/chain`:** `buildCreateIntentTx`/`buildRevokeIntentTx`/`buildAttestQualityTx` tx-builders + `addressFromPrivateKey` signer helper.
- **`packages/shared`:** new DB row types + exports; new `economics.ts` (take-rate constants, ADR-004).
- **Pre-existing bug fixes (boil-the-ocean):** `packages/walrus/src/*.ts` relative imports made extensionless (was `.js`-specifier, broke Turbopack — now matches monorepo `moduleResolution: Bundler` convention); `apps/web/lib/supabase/client.ts` env fallbacks so static prerender doesn't crash without secrets; `apps/web/next.config.ts` added `transpilePackages`.

### Next Steps
1. **Sprint 7** (`docs/SPRINTS.md` line ~495, "Streaming + SLA Staking + Insurance + Widgets", June 29–July 12, 2 weeks). Read the S7 sub-task table before starting. Note S7 risk: x402 `upto` spec ambiguity — coordinate with x402 Foundation by S6 end.
2. Sync local `main` in the primary worktree (`git pull --ff-only`).
3. S6-T10/T13 stay blocked until Raj does the mainnet keystore (BLOCKED.md item 11). Don't retry — it's not code.
4. The single highest-leverage unblock remains **BLOCKED.md item 1 (Sui keystore + testnet deploy)** and **item 2 is now DONE (GitHub repo exists)**. CI workflow will run on the next push — check it.

### Key Decisions
- **Contracts as dependency root:** landed `contracts` agent foreground first, then 4 parallel implementation agents (indexer, servers, web, sdk/gateway) briefed with the finalized contract signatures + event field list — avoids cross-agent event-shape races.
- **Migration numbering:** S6 SPRINTS text said `008_/009_` but those were already taken (users_sui/bundles); used `010–013`. SPRINTS task text corrected to real filenames.
- **walrus `.js` fix = root cause, not config band-aid:** made walrus imports extensionless to match every other monorepo package (shared/chain) under `moduleResolution: Bundler` + Turbopack, rather than fighting webpack/Turbopack extensionAlias config.
- **Supabase client env fallback:** browser client only truly runs client-side (Next inlines public env there); placeholder fallbacks just keep build-time static prerender from throwing — lets CI build with zero secrets.
- **Merge via `git push origin HEAD:main`:** local `main` is checked out in the primary worktree so couldn't `checkout main` here; pushed HEAD directly (clean fast-forward).
- **Quality score weighting locked:** availability dominates (0.5 uptime), correctness next (0.3), latency tiebreaker (0.2). Zero-call servers not attested. Deterministic UTC-anchored windows to avoid oracle drift.

### Previous Session Notes
- **S1 (2026-05-10):** 13 Move modules + atomic settlement + chain mirror schema + 65 Move tests + TS validation. (Pre-S6 history: S0 scaffold → S1 contracts → S2 facilitator+indexer → S3 chain gateway+server SDK → S4 Privy+chain+marketplace → S5 anchors #2/#3+CLI+bundles.)
