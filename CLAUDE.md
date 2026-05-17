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

## Session Context (Last updated: 2026-05-18 01:40)

### Current State
- **Sprints 0–8 complete.** Branch `claude/modest-swartz-dcdccc`. S7 pushed to `origin/main` earlier (`adda078`). S8 = local commits `b493a94` + the CLAUDE.md update — push branch → ff `main` to publish S8.
- Verification all green: `sui move test` **87/87**, `pnpm turbo run typecheck` **29/29**, `pnpm turbo run test` **27/27** (use `--continue`; turbo cancels siblings on first fail otherwise), `pnpm turbo run build` **22/22**.
- **Sprint 8: 16/19 tasks Done.** Remaining 3 are human-only (marked in SPRINTS.md): S8-T07 KOL outreach, S8-T08 Sui Foundation Telegram, S8-T14 Demo Day live performance. S8-T06 demo *script* is done (`docs/DEMO-SCRIPT.md`); the *video recording* is the human part.
- **S6-T10/T13 still blocked** (mainnet deploy of walrus-store/sui-identity — BLOCKED.md item 11, mainnet keystore, not code). BLOCKED.md item 1 (Sui keystore + testnet deploy) remains the top unblock.
- Local `main` (primary worktree) still behind; sync chain unchanged: push this branch → ff `main` → `git pull --ff-only` in primary worktree.

### Recent Changes (Sprint 8, commit b493a94 — 110 files)
- **Audit-found security fix (T-STK-1, the important one):** `contracts/sources/staking.move` `slash<T>` now takes `&QualityAttestation` and aborts unless it is for the same server (`E_ATTESTATION_SERVER_MISMATCH`), shows `uptime_x100 < stake.sla_uptime_x100` (`E_NO_SLA_BREACH`), and is fresh within `sla_window_seconds × 3` (`E_STALE_ATTESTATION`). Previously any `OracleCap` holder could slash any stake arbitrarily (the S7 comment had flagged this as pending). Propagated: `packages/chain` `buildSlashStakeTx` gained `attestationObjectId`; `apps/quality-oracle` attest pass now returns `attestationsByServer` and the slash pass skips (streak preserved) when no fresh proof exists. New negative Move tests. Move 85→87.
- **Migration (T01/T02):** `scripts/` is now a real `@mcpxgg/scripts` workspace pkg (typed, tested). `migrate-web2-users.ts` (idempotent, `--dry-run`, injectable `LegacyUserReader`/`MigrationStore`/`ChainClient`, 1 credit = $1 = 1_000_000 atomic). `apps/web` `MigrationWelcome` banner gated on `users.migration_status` + Privy.
- **Docs site (T05/T15/T12/T06):** `apps/docs` stood up on **Fumadocs** (Next 16; build uses `next build --webpack` — fumadocs-mdx loader is ESM and Turbopack's webpack-loader bridge can't `require()` it; documented in apps/docs/README). Full page tree + blog + `docs/DEMO-SCRIPT.md`.
- **Landing/marketing (T16/T17/T11/T10/T18):** rewrote `apps/web/app/page.tsx` (hero/ticker/anchor cards/insurance/`StablecoinFlow` SVG/OG image); `MarketingShell` + `/about` `/pricing` `/developers` `/security`; `/roadmap` (typed Phase-3 mirror in `lib/content/roadmap.ts`); `/status` (`lib/status/probe.ts`, `/api/healthz`); sitemap/robots/metadata/a11y.
- **Infra (T09/T19):** `scripts/loadtest/` (open-loop RPS harness, dry self-check + `--live`) and `scripts/smoke/` (cold-visitor journey: land→quickstart→recharge→call→receipt; dry + `--live`). Gateway S8-T09 bottleneck fix in `apps/gateway/src/handler.ts`: Walrus `archiveCall` moved OFF the success hot path — fire-and-forget for free-tier, archive-then-settle inside the deferred task when `settleAsync`; synchronous-settle path unchanged.
- **Audit package (T03/T13):** `docs/AUDIT.md` (trust model, per-module review w/ cited `assert!` codes, 16-row STRIDE, atomic-settlement proof sketch, real coverage **81.32%**, staking 56.51%) + `docs/SUBMISSION-CHECKLIST.md`. T-STK-1 documented as RESOLVED.

### Next Steps
1. **Push `claude/modest-swartz-dcdccc` → ff `origin/main`** to publish S8 (S7 already on remote). Check GitHub CI.
2. Sync local `main` in the primary worktree (`git pull --ff-only`).
3. **Sprint 9** (`docs/SPRINTS.md` ~line 612, "Multi-Tenant Org Sessions", July 22–28): `OrgSession`/`ScopedKey v2`/RBAC + indexer + `<OrgManager/>` + gateway scoped-key resolution. Read the S9 sub-task table first. (Phase 3 Tier B; migration `010_org_sessions.sql` text in S9-T05 is stale — real next migration number is **017** after 014/015/016.)
4. Human follow-ups outstanding: S8-T07 (KOL), S8-T08 (Sui Foundation comms), S8-T14 (Demo Day), and the demo *video* recording per docs/DEMO-SCRIPT.md. Also: a real Lighthouse run to confirm S8-T18 ≥95 (optimizations applied, score unverified headlessly).

### Key Decisions
- **Audit deliverable → real fix, not just a finding.** The audit agent surfaced T-STK-1 as a genuine latent issue; per boil-the-ocean it was fixed + tested + the AUDIT.md updated to "RESOLVED" in the same sprint (it's literally S8-T04 "audit-found bugs: triage and fix").
- **Directory-partitioned parallel agents.** S8 ran 4 agents each owning a disjoint tree (apps/web; apps/docs; scripts; docs-audit) to avoid edit races — the multi-agent pattern only works cleanly when ownership doesn't overlap.
- **Flaky-test root cause, not retry.** The loadtest dry self-check asserted a wall-clock throughput-ratio verdict; under 27 parallel turbo test tasks the box can't sustain the offered RPS → false negative that cascaded (turbo cancels siblings). Fixed by setting the dry test's `minThroughputRatio` to 0 (machinery check ≠ host-capacity check); fail-path still covered by the error-rate/p95 tests. Always run full verification with `turbo ... --continue` to see true per-package state.
- **Gateway hot-path = execute+respond; archive+settle deferred.** Walrus upload is a network round-trip; only the synchronous-settle path (rare) waits on it. Async-settle (prod default) archives-then-settles in the background so the receipt still references the blob.
- **`-- --continue` footgun:** `pnpm turbo run typecheck -- --continue` forwards `--continue` to `tsc` (TS5023). Use `pnpm turbo run <task> --continue` (no `--`).

### Previous Session Notes
- **S7 (2026-05-17→18, `adda078`):** pay-per-output streaming, SLA staking+auto-slash, insurance pool+claims, `@mcpxgg/widget`, indexer + 2 e2e lifecycles. **S6 (`7c003f8`):** intents, quality oracle, anchors #4/#5, /live. Pre-S6: S0 scaffold → S1 contracts (13 modules) → S2 facilitator+indexer → S3 chain gateway+SDK → S4 Privy+chain+marketplace → S5 anchors #2/#3+CLI+bundles → S6 → S7 → S8 migration+audit+docs+landing.
