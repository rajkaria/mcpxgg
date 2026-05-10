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
