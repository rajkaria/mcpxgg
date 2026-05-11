# MCPX Build Sprint Plan

> **Single source of truth** for all execution. Every sub-task has a stable ID (`S<sprint>-T<task>`) so it can be moved to Linear, Notion, or a spreadsheet without renaming.
>
> **Cadence.** 1 sprint = 1 week unless noted (Sprint 7 = 2 weeks, Sprint 8 = 1 week incl. Demo Day).
>
> **Hackathon ship.** Mainnet by **June 21, 2026** (end of Sprint 5). Demo Day **July 20–21, 2026**.

---

## Tracking legend

| Effort | Meaning |
|---|---|
| S | Small (≤ 4h) |
| M | Medium (1–2 days) |
| L | Large (3–5 days) |
| XL | Extra-large (>1 week) |

| Status | Meaning |
|---|---|
| ☐ | Not started |
| ◐ | In progress |
| ✓ | Done |
| ✗ | Blocked |
| ⊘ | Cancelled / superseded |

---

## Cross-cutting standards (apply to every sprint)

| Standard | Rule |
|---|---|
| Tests | Move modules: 80%+ branch coverage. TS services: vitest unit tests for critical paths; Playwright e2e for /publish, /recharge, /receipts. |
| Code review | Every PR gets reviewed (self + 1 if working with a team). No direct push to `main`. |
| CI | Lint + typecheck + tests + Move build must be green before merge. |
| Observability | Every service emits structured logs (pino). Sentry for errors. Posthog for product analytics on apps/web. |
| Secrets | `.env.local` for local. Vercel + Fly.io project settings for hosted. Never in code, never in git. |
| Docs | Every new public API documented in `apps/docs/`. Every Move module has a `// MODULE` block at top explaining purpose. |
| Security | Dependabot enabled. `pnpm audit` clean. Move package upgrade-capped behind multisig once mainnet (ADR-001). |

---

## Phase 1 — Hackathon (Sprints 0–6, mainnet by June 21)

# Sprint 0 — Foundation (May 11 – May 17, 2026)

**Goal.** Repo, scaffold, decisions, SDK spikes — everything in place to start hot work in Sprint 1.

**Deliverables.**
- `mcpxgg/` monorepo bootable with `pnpm install` + `pnpm dev` (web boots, gateway placeholder)
- GitHub repo created, CI pipeline green, Vercel preview deploys
- ChainAdapter interface drafted with stub SuiAdapter
- Privy account provisioned with Sui support enabled
- Walrus + Seal SDK spikes written (round-trip tests pass)
- Domain ownership of `mcpx.gg` confirmed
- All ADRs from `DECISIONS.md` reviewed and acknowledged

**Sub-tasks.**

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S0-T01 | Initial monorepo scaffold (already complete from initial setup) | repo | M | ✓ |
| S0-T02 | Create empty private GitHub repo `mcpxgg`, link as origin | repo | S | ☐ |
| S0-T03 | Write GitHub Actions workflow: lint + typecheck + test on every PR | `.github/workflows/ci.yml` | M | ☐ |
| S0-T04 | Configure Dependabot + CODEOWNERS | repo | S | ☐ |
| S0-T05 | Vercel project creation for `apps/web` and `apps/docs`; preview env vars wired | hosting | M | ☐ |
| S0-T06 | Fly.io app skeletons for `apps/gateway`, `apps/facilitator`, `apps/indexer` | hosting | M | ☐ |
| S0-T07 | Domain DNS: confirm `mcpx.gg` ownership; reserve `mcp.`, `facilitator.`, `docs.` subdomains | hosting | S | ☐ |
| S0-T08 | Privy account creation; configure Google + Apple + email; enable Sui in app config | auth | S | ☐ |
| S0-T09 | Spike: install `@mysten/sui` + `@privy-io/react-auth`; render Privy connect button on a placeholder page | apps/web | M | ☐ |
| S0-T10 | Spike: `@mysten/walrus` upload + retrieve a 1KB blob round-trip on testnet | packages/walrus | M | ☐ |
| S0-T11 | Spike: `@mysten/seal` encrypt + decrypt round-trip with derived keys | packages/walrus | M | ☐ |
| S0-T12 | Draft `ChainAdapter` interface in `packages/chain/src/types.ts` (12 methods per spec §3.1) | packages/chain | M | ☐ |
| S0-T13 | Stub `SuiAdapter` class in `packages/chain/src/sui-adapter.ts`; all methods throw `NotImplemented` | packages/chain | S | ☐ |
| S0-T14 | Refactor: move `apps/web/lib/{supabase,cache,twilio,utils,validation}` → `packages/shared/src/...`; update imports to `@mcpxgg/shared` | refactor | L | ☐ |
| S0-T15 | Refactor: move `apps/web/components/ui/*` → `packages/ui/src/`; update imports to `@mcpxgg/ui` | refactor | M | ☐ |
| S0-T16 | Apps/web `package.json` with `@mcpxgg/shared`, `@mcpxgg/ui`, `@mcpxgg/chain` workspace deps | apps/web | S | ☐ |
| S0-T17 | Each app + package gets a `package.json` with name, version, exports, scripts (build/lint/test/typecheck) | repo | M | ☐ |
| S0-T18 | Root `tsconfig.base.json` extended by all packages | repo | S | ✓ |
| S0-T19 | Sui CLI installed and configured for testnet locally; sui keystore separate from prod | local-dev | S | ☐ |
| S0-T20 | Move CI: install Sui CLI in CI, run `sui move build` for `contracts/` (placeholder Move.toml passes) | CI | M | ☐ |
| S0-T21 | Local Postgres (via Supabase CLI) running with current migrations 001–005 applied | local-dev | M | ☐ |
| S0-T22 | Apps/web boots locally and renders landing page with Privy connect (no auth wired yet) | smoke | M | ☐ |
| S0-T23 | All ADR decisions reviewed & locked. Surface any new disagreements in this sprint, not later. | docs | S | ☐ |

**Definition of Done.**
- `pnpm install` from root succeeds
- `pnpm dev --filter @mcpxgg/web` boots and serves the landing page
- `pnpm typecheck` and `pnpm lint` pass
- Sui testnet PTB roundtrip (publish → query) demoable with raw `sui client` (no app yet)
- Walrus blob upload + Seal encrypt round-trip both pass

**Dependencies.** None (this is the foundation).

**Risks.**
- Privy may require a Sui-specific config that's still in beta. Mitigation: also have raw `@mysten/dapp-kit` + zkLogin path as fallback (decision Sprint 0 end).
- Walrus SDK maturity. Mitigation: spike on day 1, raise blocker if API churn is heavy.

---

# Sprint 1 — Move Package Foundations + Schema (May 18 – May 24)

**Goal.** All core Move modules built, deployed to testnet, with end-to-end raw PTB tests. Schema updated with chain mirror columns.

**Deliverables.**
- 13 Move modules compiled and deployed to testnet (registry, session, settlement, vault, treasury, access, intent, staking, insurance, bundle, quality, events, admin)
- Move tests for each module (publish a server, mint a session, settle a call, claim from vault — all via raw PTB)
- Migration `006_chain_columns.sql` applied (chain_id, object_id, tx_digest, receipt_blob_id columns + chain_balances + developer_vaults tables)
- `PlatformConfig` shared object initialized on testnet with default 250 bps take rate (50 bps insurance + 200 bps treasury)

**Sub-tasks.**

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S1-T01 | `Move.toml` with mcpx package name, addresses, dependencies (@mysten/sui framework) | contracts | S | ✓ |
| S1-T02 | `mcpx::events` module: ServerPublished/Updated/Deactivated, SessionCreated/Deposit/Withdraw, CallSettled, RefundIssued, VaultClaimed, ReviewPosted (stub), QualityAttested, IntentCreated/Used, StakeSlashed, InsurancePaid, BundleCreated/Activated | contracts | M | ✓ |
| S1-T03 | `mcpx::registry` module: Server, Tool struct, ServerOwnerCap, NamespaceRegistry shared object, publish_server, update_server, deactivate | contracts | L | ✓ |
| S1-T04 | `mcpx::session` module: Session, SessionKey, create_session, deposit, withdraw, update_limits, internal debit | contracts | L | ✓ |
| S1-T05 | `mcpx::vault` module: DeveloperVault, create_vault, internal accrue, claim, auto_claim_if_threshold | contracts | M | ✓ |
| S1-T06 | `mcpx::treasury` module: PlatformTreasury, TreasuryAdminCap, internal collect_fee, withdraw | contracts | M | ✓ |
| S1-T07 | `mcpx::insurance` module: InsurancePool shared object, internal collect_insurance, claim_insurance (called by user on validated downtime) | contracts | M | ✓ |
| S1-T08 | `mcpx::settlement` module: CallReceipt struct, settle_call (atomic PTB: debit session, split take rate 50bps insurance + 200bps treasury, credit vault, mint receipt, emit event); refund deferred to S2 | contracts | XL | ✓ |
| S1-T09 | `mcpx::admin` module: PlatformConfig shared object (take_rate_bps, insurance_bps, subsidy_atomic, sla_minimums), AdminCap, update functions multisig-gated | contracts | M | ✓ |
| S1-T10 | `mcpx::access` module: ScopedKey (Sprint 9 expands; initial stub for Sprint 4 API key rebinding) | contracts | M | ✓ |
| S1-T11 | `mcpx::intent` module: SpendingIntent (Sprint 6 expands; initial stub here) | contracts | S | ✓ |
| S1-T12 | `mcpx::staking` module: ServerStake (Sprint 7 expands; initial stub here) | contracts | S | ✓ |
| S1-T13 | `mcpx::bundle` module: Bundle (Sprint 5 expands; initial stub here) | contracts | S | ✓ |
| S1-T14 | `mcpx::quality` module: QualityAttestation, OracleCap, attest function | contracts | M | ✓ |
| S1-T15 | Move tests: each module has unit tests; integration test publishes server → mints session → settles call → claims vault | contracts/tests | XL | ✓ |
| S1-T16 | `contracts/scripts/deploy-testnet.sh`: deploys package, initializes shared objects, prints object IDs | contracts/scripts | M | ✓ |
| S1-T17 | First testnet deploy. Capture all object IDs in `.env.example` and DEPLOY.md | contracts | S | ☐ |
| S1-T18 | Migration `006_chain_columns.sql`: ALTER `mcp_servers`, `request_log` to add chain_id, object_id, tx_digest, receipt_blob_id; CREATE chain_balances, developer_vaults | supabase | M | ✓ |
| S1-T19 | Update `packages/shared/src/types/database.ts` to reflect new columns | packages/shared | S | ✓ |
| S1-T20 | Update `lib/validation/config-schema.ts`: replace `creditCost: 1\|3\|10` with `priceAtomic: bigint`; add `freeTierCallsPerUser: number` | packages/shared | S | ✓ |
| S1-T21 | Devnet-faucet helper script: `scripts/fund-test-account.sh` (gets testnet SUI from public faucet) | scripts | S | ✓ |

**Sprint 1 status (2026-05-10).** All code-side tasks ✓. Outstanding: S1-T17 testnet deploy
(needs Sui keystore + testnet SUI; run `contracts/scripts/deploy-testnet.sh` to execute).
Test stats: 65 Move tests + 16 TS validation tests = 81 passing. Move coverage 77.54%
(admin/vault/treasury 100%, registry 90%, settlement 82%; stubs lower as expected).

**Sprint 2 status (2026-05-11).** All code-side tasks ✓. Outstanding: live-credential
deploys S2-T10 (facilitator → Fly.io), S2-T11 (DNS for `facilitator.mcpx.gg`),
S2-T21 (indexer → Fly.io), and the testnet-bound E2E tests S2-T22/T23 (which need
S1-T17 testnet deploy first). Test stats: 128 TS tests (29 x402 + 44 facilitator
+ 39 indexer + 16 shared) + 65 Move = **193 passing**. Turbo typecheck green
across all 14 packages.

**Definition of Done.**
- `sui move build` clean for all 13 modules
- All Move tests pass
- Testnet deploy returns valid object IDs for: package, NamespaceRegistry, PlatformTreasury, InsurancePool, PlatformConfig
- An end-to-end raw PTB test (publish → session → settle → claim) executes successfully
- `006_chain_columns.sql` applies cleanly to local Supabase

**Dependencies.** Sprint 0 (toolchain).

**Risks.**
- Move PTB complexity for atomic settlement — may need to split for gas budget. Mitigation: profile early; use `sui client dry-run` to size.
- USDsui type tag stability on testnet. Mitigation: pin a known type; document in DEPLOY.md.

---

# Sprint 2 — x402 Facilitator + Indexer (May 25 – May 31)

**Goal.** Facilitator and indexer running locally and on Fly.io. End-to-end: facilitator-mediated settlement → indexer hydrates Postgres → marketplace query reflects new state in <2s.

**Deliverables.**
- `apps/facilitator` running at `facilitator.mcpx.gg` with `/verify`, `/settle`, `/supported` endpoints implementing x402 spec for Sui
- `apps/indexer` subscribing to Sui events and hydrating Postgres views
- `007_indexer_views.sql` migration (materialized views: `marketplace_servers`, `dashboard_usage`, `live_feed`)
- Sponsored gas station pattern wired (facilitator pays gas, recovers from treasury)

**Sub-tasks.**

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S2-T01 | `apps/facilitator/package.json`, hono-based HTTP server, base structure | apps/facilitator | M | ✓ |
| S2-T02 | x402 spec types in `packages/x402/src/types.ts` (PaymentPayload, PaymentDetails, VerifyResult, SettleResult) | packages/x402 | S | ✓ |
| S2-T03 | Facilitator `/supported` endpoint — returns schemes `['exact','upto']` networks `['sui-testnet','sui-mainnet']` | apps/facilitator | S | ✓ |
| S2-T04 | Facilitator `/verify` — validates payment payload signature; checks session balance, spending policies via Sui RPC | apps/facilitator | L | ✓ |
| S2-T05 | Facilitator `/settle` (exact scheme) — builds PTB calling `mcpx::settlement::settle_call`; signs as gas station; submits; awaits finality | apps/facilitator | XL | ✓ |
| S2-T06 | Sponsored gas station: facilitator key holds SUI for gas; tracks spending; configurable rate-limits | apps/facilitator | M | ✓ |
| S2-T07 | Apache 2.0 LICENSE file in `apps/facilitator/` | apps/facilitator | S | ✓ |
| S2-T08 | Facilitator README explaining x402 compliance + self-host instructions | apps/facilitator | M | ✓ |
| S2-T09 | Facilitator unit tests (verify validation cases + settle dry-run cases) | apps/facilitator | M | ✓ |
| S2-T10 | Facilitator deploy to Fly.io with mlocked private key + multi-region | apps/facilitator | M | ☐ |
| S2-T11 | DNS: `facilitator.mcpx.gg` → Fly.io | hosting | S | ☐ |
| S2-T12 | `apps/indexer/package.json`, base subscriber using `@mysten/sui` event API | apps/indexer | M | ✓ |
| S2-T13 | Indexer event handlers: ServerPublished, ServerUpdated, ServerDeactivated → upsert `mcp_servers` | apps/indexer | M | ✓ |
| S2-T14 | Indexer event handlers: SessionCreated, SessionDeposit, SessionWithdraw → upsert `chain_balances` | apps/indexer | M | ✓ |
| S2-T15 | Indexer event handler: CallSettled → INSERT `request_log` (with tx_digest + receipt_blob_id) | apps/indexer | M | ✓ |
| S2-T16 | Indexer event handler: VaultClaimed → upsert `developer_vaults` lifetime totals | apps/indexer | M | ✓ |
| S2-T17 | Indexer checkpoint tracking: `last_processed_checkpoint` persisted to Postgres; replay-safe on restart | apps/indexer | M | ✓ |
| S2-T18 | Indexer dedup: PRIMARY KEY on `(tx_digest, event_seq)` for idempotent upserts | apps/indexer | S | ✓ |
| S2-T19 | Migration `007_indexer_views.sql`: materialized views `marketplace_servers`, `dashboard_usage`, `live_feed_24h` | supabase | M | ✓ |
| S2-T20 | Indexer Redis pub/sub: publishes `event:CallSettled` with payload for /live | apps/indexer | M | ✓ |
| S2-T21 | Indexer deploy to Fly.io (single active instance, passive standby) | apps/indexer | M | ☐ |
| S2-T22 | E2E test: publish server via raw Move call → wait 5s → query `marketplace_servers` view → row exists | tests | M | ☐ |
| S2-T23 | E2E test: settle a call via facilitator → wait 5s → query `dashboard_usage` → row exists with tx_digest | tests | M | ☐ |
| S2-T24 | Facilitator + indexer integration in Turbo: `pnpm dev` starts both alongside web | repo | S | ✓ |

**Definition of Done.**
- Facilitator deployed at facilitator.mcpx.gg, returning correct `/supported`, validating real payments, settling real calls on testnet
- Indexer in active steady state, lag ≤ 2s in p95
- Facilitator + indexer pass health checks; auto-restart on crash
- E2E settlement test passes from CI

**Dependencies.** Sprint 1 (Move package on testnet).

**Risks.**
- Sponsored gas key compromise. Mitigation: separate keystore, fly-secrets, daily key rotation post-mainnet.
- Indexer lag spikes. Mitigation: alarm at >5s lag; passive standby for failover.

---

# Sprint 3 — Gateway Split + Anchor #1 walrus-search (June 1 – June 7)

**Goal.** `apps/gateway` is its own deployable service. First anchor MCP server (`walrus-search`) is live and end-to-end working: a Cursor user can call `walrus-search/query` via the gateway and get a result with a real receipt.

**Deliverables.**
- `apps/gateway` deployed at `mcp.mcpx.gg`, MCP JSON-RPC compliant, settling via facilitator
- Anchor server #1 `servers/walrus-search/` live on testnet
- Gateway `_meta.receipt = { tx_digest, blob_id, amount, chain }` populated and verifiable
- "Powered by mcpxgg" attribution injected in `_meta`

**Sub-tasks.**

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S3-T01 | `apps/gateway` standalone hono app; lift handler/router/executor from copied `lib/gateway/*` | apps/gateway | M | ☐ |
| S3-T02 | Gateway auth: API key lookup → Redis cache → Postgres fallback; returns `{user_id, session_id, scoped_servers, balance_atomic}` | apps/gateway | M | ☐ |
| S3-T03 | Gateway pre-flight checks: session balance, spending policies (per-call cap, per-day cap), scoped key allowed servers | apps/gateway | M | ☐ |
| S3-T04 | Gateway calls facilitator `/settle` after server response; non-blocking option via flag | apps/gateway | M | ☐ |
| S3-T05 | Walrus blob upload of request/response (parallel with settlement); blob_id returned in receipt | apps/gateway | M | ☐ |
| S3-T06 | Gateway `_meta.receipt` injection: tx_digest, blob_id, amount, chain, "Powered by mcpxgg" | apps/gateway | S | ☐ |
| S3-T07 | Gateway error handling: server error → no settle; settle failure after server success → log + best-effort retry | apps/gateway | M | ☐ |
| S3-T08 | Gateway tests: unit (handler dispatch), integration (real testnet, live facilitator) | apps/gateway | L | ☐ |
| S3-T09 | Gateway deploy to Fly.io at `mcp.mcpx.gg`; env wired | apps/gateway | M | ☐ |
| S3-T10 | DNS: `mcp.mcpx.gg` → Fly.io | hosting | S | ☐ |
| S3-T11 | Update `apps/web/app/api/mcp` route to forward to `mcp.mcpx.gg` for backward compat (or remove if direct deploy works) | apps/web | S | ☐ |
| S3-T12 | `servers/walrus-search/` package: hono server using `@mcpxgg/server` SDK (skeleton even if SDK is mostly stubbed) | servers/walrus-search | L | ☐ |
| S3-T13 | walrus-search tools: `index`, `query`, `delete_index` per spec §10.1 | servers/walrus-search | XL | ☐ |
| S3-T14 | walrus-search infra: vector store (Pinecone or Qdrant); embeddings via OpenAI/Voyage | servers/walrus-search | L | ☐ |
| S3-T15 | walrus-search published to testnet via raw Move call (CLI exists yet — use raw `sui client` for now) | servers/walrus-search | M | ☐ |
| S3-T16 | walrus-search deploy to Vercel (or Fly.io); endpoint URL recorded in registry | hosting | M | ☐ |
| S3-T17 | E2E demo from Cursor: configure Cursor with mcpxgg API key + endpoint; call `walrus-search/query`; receipt visible on testnet explorer | demo | M | ☐ |
| S3-T18 | First-pass `@mcpxgg/server` SDK skeleton: `createMCPXServer({namespace}).tool({...})` — formalizes what walrus-search did manually | packages/sdk-server | L | ☐ |

**Definition of Done.**
- Gateway live at `mcp.mcpx.gg`
- walrus-search live; one query end-to-end from Cursor produces a verifiable receipt
- Demo video recorded (raw, not polished) for share with Sui Foundation
- p50 latency under 1.2s for cold call (Walrus upload sequential), under 800ms with parallelized Walrus upload

**Dependencies.** Sprint 2 (facilitator + indexer).

**Risks.**
- Vector store latency. Mitigation: aggressive caching, pre-index at publish time.
- Cursor MCP config corner cases. Mitigation: setup wizard in Sprint 4.

---

# Sprint 4 — Web Cutover + Recharge Flow + Receipts + Privy (June 8 – June 14)

**Goal.** mcpx.gg is fully wired to chain-backed data. Users can sign in via Privy, recharge USDsui to a Session, see receipts, and copy a setup config for their AI client.

**Deliverables.**
- Privy auth wrapped around `apps/web` with derived Sui address per user
- `<RechargeFlow />` component: connect → enter amount → wallet sign → Session deposit
- `<ReceiptHistory />` and `/receipts/[id]` page
- Setup wizard at `/setup` with per-client config (Cursor, Claude Desktop, Windsurf, Cline)
- Marketplace and dashboard pages reading from indexer mirror

**Sub-tasks.**

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S4-T01 | Privy SDK install + `<PrivyProvider>` in `apps/web/app/layout.tsx`; configure Sui wallet support | apps/web | M | ☐ |
| S4-T02 | Replace existing Supabase Auth login UI with `<PrivyConnect />` component | apps/web | M | ☐ |
| S4-T03 | Privy server-side: validate session token in middleware; populate `users.sui_address` on first sign-in | apps/web | M | ☐ |
| S4-T04 | Schema: ALTER `users` add `sui_address` (nullable, populated on first wallet sign), `migration_status` ('legacy'|'migrating'|'migrated') | supabase | S | ☐ |
| S4-T05 | API key auto-generation on first sign-in; rebind to a new on-chain Session | apps/web + apps/gateway | M | ☐ |
| S4-T06 | `<RechargeFlow />` component: Privy wallet connect → input amount in USD → quote in USDsui via current rate → sign deposit tx | apps/web | L | ☐ |
| S4-T07 | First Session creation flow: if user has no Session yet, recharge creates one (PTB: createSession + deposit in one tx) | apps/web + packages/chain | M | ☐ |
| S4-T08 | `<SessionBalance />` widget on dashboard reading from `chain_balances` view | apps/web | M | ☐ |
| S4-T09 | `/dashboard/usage` rebuilt to show receipt links per row (tx_digest → suiscan.xyz, blob_id → walrus viewer) | apps/web | M | ☐ |
| S4-T10 | `/receipts/[id]` page: fetch CallReceipt object via Sui RPC → fetch Walrus blob → render request/response | apps/web | L | ☐ |
| S4-T11 | Seal-encrypted receipt viewer: if blob is Seal'd, show metadata + "Decrypt as caller" / "Decrypt as server owner" buttons | apps/web + packages/walrus | L | ☐ |
| S4-T12 | Marketplace browse rebuilt to read `marketplace_servers` view; "View on chain" + Walrus README link per server | apps/web | M | ☐ |
| S4-T13 | Server detail page (`/marketplace/[namespace]`): fetch full server + tools from view; render Walrus README | apps/web | M | ☐ |
| S4-T14 | `/setup` setup-wizard page: pick client (Cursor / Claude Desktop / Windsurf / Cline / API), get exact JSON config to copy | apps/web | M | ☐ |
| S4-T15 | Bootstrap subsidy grant flow: on phone-verify success, grant 1.00 USDsui to user's first Session via admin-signed tx | apps/web + apps/facilitator | M | ☐ |
| S4-T16 | Subsidy budget tracking: monthly cap enforced via `PlatformConfig`; admin script to refill | apps/facilitator | S | ☐ |
| S4-T17 | Audit log CSV export from `/dashboard/usage` (all request_log rows for user) | apps/web | S | ☐ |
| S4-T18 | Live ticker on landing page: top right "$X cumulative settled, Y calls today" | apps/web | M | ☐ |
| S4-T19 | Updated landing copy across `/`, `/about`, `/pricing`, `/developers`: "USDsui", "wallet", remove credit/subscription language | apps/web | M | ☐ |
| S4-T20 | Posthog product analytics installed in `apps/web` | apps/web | S | ☐ |
| S4-T21 | Sentry error tracking in `apps/web`, `apps/gateway`, `apps/facilitator`, `apps/indexer` | observability | M | ☐ |
| S4-T22 | E2E test: signup via Privy Google → recharge $5 → call walrus-search → see receipt in dashboard → click receipt → see Walrus blob | tests | L | ☐ |

**Definition of Done.**
- Cold-start user flow: Privy sign-in → recharge → call → see receipt in <2 minutes
- All marketplace pages render from indexer mirror, no chain RPC on hot path
- Setup wizard produces config that works in at least Cursor + Claude Desktop
- E2E test passes in CI

**Dependencies.** Sprint 3 (gateway + walrus-search live).

**Risks.**
- Privy embedded wallet on Sui may have edge cases. Mitigation: have external wallet (Suiet) connect ready as fallback.
- Walrus retrieval latency for receipt viewer. Mitigation: aggressive client-side cache, Walrus aggregator close to user region.

---

# Sprint 5 — Anchors #2 #3 + CLI Publish + Composable Bundles (June 15 – June 21) — MAINNET DEPLOY

**Goal.** Two more anchor servers live. Publishing flow works for external developers via `npx mcpxgg publish`. **Move package deploys to mainnet by end of sprint.**

**Deliverables.**
- `servers/sui-defi-data/` and `servers/sui-analytics/` live
- `cli/` package: `npx mcpxgg publish ./my-server` — validates, uploads docs to Walrus, signs Move publish tx
- `<BundleManager />` UI: enable a bundle = enable N servers in one tx
- **Move package deployed to mainnet**, all object IDs locked into `.env.example`

**Sub-tasks.**

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S5-T01 | `servers/sui-defi-data/`: tools `pools`, `prices`, `pool_history`, `swap_quote` per spec §10.2 | servers | XL | ☐ |
| S5-T02 | sui-defi-data: SDK integrations (Cetus, Bluefin, Scallop, Navi, DeepBook); normalize output | servers | L | ☐ |
| S5-T03 | sui-defi-data: deploy + publish to mainnet | hosting | M | ☐ |
| S5-T04 | `servers/sui-analytics/`: tools `query`, `address_history`, `object_history`, `whale_alert` per spec §10.3 | servers | XL | ☐ |
| S5-T05 | sui-analytics: indexed Sui state in Postgres + ClickHouse; LLM (Haiku) NL→SQL | servers | XL | ☐ |
| S5-T06 | sui-analytics: deploy + publish to mainnet | hosting | M | ☐ |
| S5-T07 | `cli/src/commander.ts`: `mcpxgg publish` command parses `mcpx.config.json` | cli | M | ☐ |
| S5-T08 | CLI publish gates (port from `lib/developer/publishing.ts`): namespace uniqueness via NamespaceRegistry RPC, schema validate, price range validate, endpoint health probe | cli | L | ☐ |
| S5-T09 | CLI: README + tool schemas uploaded to Walrus → blob_ids | cli | M | ☐ |
| S5-T10 | CLI: builds PTB calling `mcpx::registry::publish_server`; user signs via wallet (Privy embedded or external) | cli | L | ☐ |
| S5-T11 | CLI: prints server_object_id, tx digest, explorer URL on success | cli | S | ☐ |
| S5-T12 | CLI: publish to npm as `@mcpxgg/cli` with `bin: { mcpxgg: ... }` | cli | S | ☐ |
| S5-T13 | `mcpx.config.json` schema docs in `apps/docs` | apps/docs | M | ☐ |
| S5-T14 | Update `starter-template/`: add `@mcpxgg/server` dep, Sui pricing examples, `npx mcpxgg publish` instructions | starter-template | M | ☐ |
| S5-T15 | `mcpx::bundle::Bundle` Move object: shared, owned by curator, contains `vector<ID>` server refs + per-call multiplier | contracts | M | ☐ |
| S5-T16 | Bundle activation tx: enable_bundle(user, bundle_id) atomically enables all referenced servers in one PTB | contracts | M | ☐ |
| S5-T17 | Indexer: BundleCreated/Updated/Activated event handlers → mirror to Postgres `bundles` table | apps/indexer | M | ☐ |
| S5-T18 | `<BundleManager />` UI: list curated bundles, "Enable bundle" button | apps/web | M | ☐ |
| S5-T19 | Seed 3 curated bundles: "DeFi research" (sui-defi-data + sui-analytics), "Walrus toolkit" (walrus-search + walrus-store-stub), "Identity stack" (sui-identity-stub + sui-analytics) | data | S | ☐ |
| S5-T20 | Bundle marketplace page `/bundles` | apps/web | M | ☐ |
| S5-T21 | Mainnet deploy preparation: audit Move code, dry-run all initialization, multisig key setup for AdminCap | contracts | L | ☐ |
| S5-T22 | **Mainnet deploy**: `contracts/scripts/deploy-mainnet.sh`. Lock object IDs in DEPLOY.md and prod `.env` | contracts | M | ☐ |
| S5-T23 | Re-publish anchor servers (walrus-search, sui-defi-data, sui-analytics) to mainnet | servers | M | ☐ |
| S5-T24 | Update prod `apps/web`, `apps/gateway`, `apps/facilitator`, `apps/indexer` env to point at mainnet | hosting | S | ☐ |
| S5-T25 | Post-mainnet sanity: end-to-end mainnet call from Cursor, receipt verifiable on suiscan | smoke | M | ☐ |

**Definition of Done.**
- Mainnet Move package deployed; all 13 modules functional
- 3 anchor servers live on mainnet
- External dev can `npx mcpxgg publish` a server in under 60 seconds
- 3 curated bundles enableable in one click

**Dependencies.** Sprint 4 (web ready), Sprint 1 (Move package).

**Risks.**
- Mainnet deploy bug. Mitigation: full testnet rehearsal in S5-T21; multisig deploy gate.
- Anchor server stack complexity (sui-analytics LLM in particular). Mitigation: start with smaller surface, expand week-by-week.

---

# Sprint 6 — Anchors #4 #5 + /live + Spending Intents + Quality Oracle (June 22 – June 28)

**Goal.** All 5 anchor servers live. Bloomberg-terminal `/live` page shipped. Agent Spending Intents (Tier A #1) usable. Quality oracle producing first attestations.

**Deliverables.**
- `servers/walrus-store/` and `servers/sui-identity/` live on mainnet
- `/live` page rendering real-time platform activity
- `mcpx::intent::SpendingIntent` Move object with full lifecycle (create, use, revoke); web UI for managing intents
- Quality oracle service producing first `QualityAttestation` for each anchor server

**Sub-tasks.**

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S6-T01 | `mcpx::intent::SpendingIntent` Move: agent_address, allowed_categories, daily_cap, per_call_cap, expires_at | contracts | M | ☐ |
| S6-T02 | Intent settlement integration: `settle_call` accepts an optional intent_id; checks agent_address matches caller, decrements daily counter | contracts | M | ☐ |
| S6-T03 | Intent revocation tx + IntentRevoked event | contracts | S | ☐ |
| S6-T04 | Indexer: IntentCreated, IntentUsed, IntentRevoked → `intents` table | apps/indexer | M | ☐ |
| S6-T05 | `<IntentManager />` UI: list active intents, create new (pick agent address, category, daily cap, expiry), revoke | apps/web | L | ☐ |
| S6-T06 | Gateway integration: if request includes `X-Mcpx-Intent-Id`, validate intent before settlement | apps/gateway | M | ☐ |
| S6-T07 | `@mcpxgg/sdk` extension: `client.callTool(..., { intentId })` for agents | packages/sdk-client | S | ☐ |
| S6-T08 | Docs: "Building an autonomous agent that uses MCPX" guide referencing intents | apps/docs | M | ☐ |
| S6-T09 | `servers/walrus-store/`: tools `upload`, `retrieve`, `metadata`, `list` per spec §10.4 | servers | L | ☐ |
| S6-T10 | walrus-store: deploy + publish to mainnet | hosting | M | ☐ |
| S6-T11 | `servers/sui-identity/`: tools `resolve_address`, `resolve_name`, `verify_zklogin`, `address_reputation` per spec §10.5 | servers | L | ☐ |
| S6-T12 | sui-identity: SuiNS integration; zkLogin proof verifier; reputation stub from CallReceipt count | servers | L | ☐ |
| S6-T13 | sui-identity: deploy + publish to mainnet | hosting | M | ☐ |
| S6-T14 | `/live` page Bloomberg-style layout: live feed + cumulative metrics + top servers + active users | apps/web | L | ☐ |
| S6-T15 | `/live` data via SSE/WebSocket from indexer Redis pub/sub | apps/web + apps/indexer | M | ☐ |
| S6-T16 | `/live` cumulative metric polling for 24h windows from materialized views | apps/web | M | ☐ |
| S6-T17 | `/live` social embed-friendly OG image (every page-load updates image with current numbers) | apps/web | M | ☐ |
| S6-T18 | Quality oracle service: `apps/quality-oracle/` (or as part of indexer) — every 6h, computes uptime + latency + error_rate per server, attests on-chain | apps/indexer + contracts | L | ☐ |
| S6-T19 | Quality score badge on marketplace + server detail | apps/web | M | ☐ |
| S6-T20 | Migration `008_quality_attestations.sql`: mirror of QualityAttestation events | supabase | S | ☐ |
| S6-T21 | Migration `009_intents_bundles_staking.sql`: mirror of intents, bundles, stakes (stakes used in S7) | supabase | S | ☐ |
| S6-T22 | Try-before-you-enable: "Demo call" button on each server detail page; uses 1 free call from treasury subsidy | apps/web + apps/facilitator | M | ☐ |
| S6-T23 | Credit alert: push email + in-app when session balance < $0.50 | apps/web | M | ☐ |
| S6-T24 | Revenue calculator widget on `/developers` landing | apps/web | M | ☐ |
| S6-T25 | Featured server rotation admin UI (curate weekly featured) | apps/web | S | ☐ |
| S6-T26 | Abuse detection heuristics: flag accounts with >3 sigma anomalous patterns; admin review queue | apps/indexer + apps/web | M | ☐ |

**Definition of Done.**
- All 5 anchor servers live + indexed + listed in marketplace
- /live page updates in real-time with at least one platform metric every 30s
- Spending Intents demoable: a script "agent" running locally signs intent → uses it across multiple calls → user revokes → next call fails
- Quality oracle has produced attestations for all 5 anchor servers

**Dependencies.** Sprint 5 (mainnet).

**Risks.**
- Intent UX confusing for non-technical users. Mitigation: hide behind "Advanced" by default; agents are the target audience.
- Quality oracle off-chain compute drift. Mitigation: deterministic windows (UTC-anchored 6h) + signed attestations.

---

## Phase 2 — Polish + Demo (Sprints 7–8)

# Sprint 7 — Streaming + SLA Staking + Insurance + Widgets (June 29 – July 12, 2 WEEKS)

**Goal.** Ship Tier A #2, #3, #4, #6. The features that move mcpxgg from "winning hackathon demo" to "product the market needs."

**Deliverables.**
- Pay-per-output streaming via x402 `upto` scheme (Tier A #2)
- Server SLA staking with auto-slash to insurance (Tier A #3)
- Treasury Insurance Pool with claim flow (Tier A #4)
- `<mcpx-call>` embeddable widget published as `@mcpxgg/widget` (Tier A #6)

**Sub-tasks.**

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| **A2 — Pay-per-output streaming** | | | | |
| S7-T01 | x402 `upto` scheme types in `packages/x402` | packages/x402 | S | ☐ |
| S7-T02 | Facilitator `/settle` upto-mode: settles up to a quoted max; refunds delta on completion | apps/facilitator | L | ☐ |
| S7-T03 | Move: `settlement::settle_call_upto` variant that accepts max amount + actual usage post-completion | contracts | M | ☐ |
| S7-T04 | Gateway: streaming detection (`Accept: text/event-stream`), per-chunk metering, finalize on stream close | apps/gateway | XL | ☐ |
| S7-T05 | `@mcpxgg/server` SDK: `tool.handler` can return an async iterator → SDK metering wraps each chunk | packages/sdk-server | L | ☐ |
| S7-T06 | E2E test: streaming server call returns 5 chunks, settles for chunk count not max | tests | M | ☐ |
| **A3 — SLA Staking + Auto-Slash** | | | | |
| S7-T07 | `mcpx::staking::ServerStake` Move: developer locks USDsui as collateral, sla_tier (95/99/99.9), expiry | contracts | M | ☐ |
| S7-T08 | `mcpx::staking::slash` callable by quality oracle multisig: slashes stake proportionally to SLA breach magnitude, transfers slashed USDsui to InsurancePool | contracts | M | ☐ |
| S7-T09 | Quality oracle service computes hourly SLA compliance per staked server; triggers slashing when threshold breached for ≥2 windows | apps/quality-oracle | L | ☐ |
| S7-T10 | `<StakingFlow />` UI in dev dashboard: lock stake, choose SLA tier, view slashed history | apps/web | M | ☐ |
| S7-T11 | Server detail page shows "🔒 $X staked at 99% SLA" badge | apps/web | S | ☐ |
| S7-T12 | Marketplace filter: "Servers with stake" toggle | apps/web | S | ☐ |
| S7-T13 | E2E test: stake server → simulate downtime via test harness → verify slashing tx | tests | M | ☐ |
| **A4 — Insurance Pool** | | | | |
| S7-T14 | `mcpx::insurance::claim_for_failed_call` Move: anyone can submit a CallReceipt with `success: false` to claim back the call cost from InsurancePool, capped at pool balance | contracts | M | ☐ |
| S7-T15 | Auto-claim integration in gateway: failed call response includes "Claim refund" link to call this fn from user wallet | apps/web | M | ☐ |
| S7-T16 | InsurancePool dashboard for transparency at `/insurance`: balance, payouts to date, top contributors | apps/web | M | ☐ |
| S7-T17 | Take-rate split now active: 250bps total = 50bps insurance + 200bps treasury; verify split correctness in settlement tests | contracts | M | ☐ |
| S7-T18 | Insurance fund admin tools: top up from external sources (sponsor donations) | apps/web | S | ☐ |
| S7-T19 | E2E test: simulate downtime call → user clicks Claim → InsurancePool balance decreases | tests | M | ☐ |
| **A6 — Embeddable widgets** | | | | |
| S7-T20 | `packages/widget/`: web component (`<mcpx-call server tool prefill>`) with bundled wallet UI | packages/widget | XL | ☐ |
| S7-T21 | Widget Privy integration (or fall back to bare wallet connect) | packages/widget | M | ☐ |
| S7-T22 | Widget styling system: themeable via CSS vars; default and dark modes | packages/widget | M | ☐ |
| S7-T23 | Widget published as `@mcpxgg/widget` on npm + CDN bundle | packages/widget | M | ☐ |
| S7-T24 | Widget docs page at `apps/docs/embed` with live examples | apps/docs | M | ☐ |
| S7-T25 | Embed examples in landing page `/` and in marketplace server detail pages | apps/web | M | ☐ |
| S7-T26 | Demo: Notion / personal-site embed of `<mcpx-call server="walrus-search">` working with one user click | demo | M | ☐ |

**Definition of Done.**
- LLM-style streaming server (you can mock one) settles per-chunk and refunds correctly on early abort
- A test server with SLA stake auto-slashes on a deliberately injected breach; insurance pool balance increases by slashed amount
- Insurance claim works end-to-end from a downtime call
- Widget embedded in a third-party page (Notion, personal blog) works one-shot

**Dependencies.** Sprint 6 (mainnet stable).

**Risks.**
- x402 `upto` spec ambiguity. Mitigation: coordinate with x402 Foundation by Sprint 6 end.
- Slashing edge cases (time-zone alignment, false positives). Mitigation: 2-window minimum, multisig gate on initial slashing.

---

# Sprint 8 — Migration + Audit Prep + Demo Day (July 13 – July 19, Demo Day July 20–21)

**Goal.** Migration script ready, audit ready, demo polished.

**Deliverables.**
- Web2 → Sui migration script: legacy users get bootstrap balance proportional to remaining `credit_ledger`
- Audit submission to OtterSec / OpenZeppelin (request hackathon credits)
- Demo Day script rehearsed; backup video recorded
- Documentation site at `docs.mcpx.gg`

**Sub-tasks.**

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S8-T01 | Migration script (`scripts/migrate-web2-users.ts`): reads legacy `credit_balance` from old DB → mints Session with USDsui equivalent (per ADR-008 1:1) → writes `users.migration_status='migrated'` | scripts | M | ☐ |
| S8-T02 | Migration UX: legacy user lands on mcpx.gg → sees "Welcome back. Your balance has been moved on-chain." → guided through Privy connect | apps/web | M | ☐ |
| S8-T03 | Audit submission package: cleaned-up Move source, threat model, test coverage report → submit to OtterSec | contracts | M | ☐ |
| S8-T04 | Audit-found bugs: triage and fix in worktree branch; deploy patch | contracts | M | ☐ |
| S8-T05 | Documentation site at `apps/docs/` (Nextra/Fumadocs): home, quickstart, recipes, SDK reference, x402 spec | apps/docs | XL | ☐ |
| S8-T06 | Demo Day script polish: 3-minute walkthrough rehearsed, scripted; backup pre-recorded video at 1080p | demo | M | ☐ |
| S8-T07 | KOL outreach for Demo Day: identify 5 Sui devs to live-tweet during demo | marketing | M | ☐ |
| S8-T08 | Sui Foundation pre-coordination via Telegram: ensure live demo support | comms | S | ☐ |
| S8-T09 | Loadtest gateway + facilitator at 100 calls/sec; identify bottlenecks; fix | infra | M | ☐ |
| S8-T10 | Status page at `status.mcpx.gg` for transparent monitoring (uptime per service) | infra | M | ☐ |
| S8-T11 | Public roadmap page at `apps/web/roadmap` (read-only mirror of post-hackathon SPRINTS) | apps/web | S | ☐ |
| S8-T12 | First blog post on `apps/docs/blog/`: "MCPX is mainnet on Sui" | content | M | ☐ |
| S8-T13 | Submission checklist (per hackathon handbook) — see SPRINTS appendix | submission | M | ☐ |
| S8-T14 | **Demo Day live performance** | demo | — | ☐ |
| **Docs + Landing refactor (post-feature-freeze)** | | | | |
| S8-T15 | `apps/docs/` site stand-up at `docs.mcpx.gg` (Fumadocs or Nextra). Sections: Home, Quickstart (5-min user, 5-min developer), Core concepts (Sessions, Vaults, Receipts, Intents, Bundles, Insurance), SDK refs (`@mcpxgg/sdk-client`, `@mcpxgg/sdk-server`, `@mcpxgg/widget`), x402 facilitator spec, Move package reference, Recipes (build an agent, embed a tool, run your own marketplace) | apps/docs | XL | ☐ |
| S8-T16 | Landing page refactor (`apps/web/app/page.tsx` + `/about`, `/pricing`, `/developers`): hero rebuilt around "on-chain MCP marketplace settled in USDsui", live cumulative-settled ticker, "Powered by Sui + x402" trust strip, 5 anchor server cards, Insurance Pool transparency box, CTAs split for end-users vs developers, dark-mode polish, OG/Twitter cards with live numbers, animated stable-coin flow diagram | apps/web | L | ☐ |
| S8-T17 | Marketing pages refresh: `/about` (mission, no credits/subscriptions, x402 differentiator), `/pricing` (USDsui, take-rate breakdown 50bps insurance + 200bps treasury), `/developers` (revenue calculator, vault auto-claim, SLA staking, payout chain selector preview), `/security` (Move modules, audit status, multisig admin) | apps/web | M | ☐ |
| S8-T18 | Lighthouse 95+ on Performance, Accessibility, SEO, Best Practices for `/`, `/marketplace`, `/dashboard`, `/receipts/[id]` | apps/web | M | ☐ |
| S8-T19 | Docs + landing E2E smoke: cold visitor → reads quickstart → recharges $1 → calls walrus-search → sees receipt | tests | M | ☐ |

**Definition of Done.**
- Audit submitted; critical findings (if any) patched
- Demo rehearsed under 3:00 with margin
- Status page live; public roadmap live
- All 12 spec §14.1 P0 items demonstrably working on mainnet

**Dependencies.** Sprint 7.

**Risks.**
- Audit critical finding late. Mitigation: testnet rehearsal in S5; OtterSec early-engagement in S6.
- Demo Day mainnet outage. Mitigation: backup recorded video; hot-standby for facilitator and indexer.

---

## Phase 3 — Post-Hackathon Tier B (Sprints 9–15)

# Sprint 9 — Multi-Tenant Org Sessions (July 22 – July 28)

**Goal.** B1 — Org accounts, on-chain.

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S9-T01 | `mcpx::session::OrgSession` Move: extends Session with `members: vector<address>`, `roles` map, `per_member_caps` | contracts | M | ☐ |
| S9-T02 | `mcpx::access::ScopedKey` v2: scoped per (org_session, member, role), with monthly limits | contracts | M | ☐ |
| S9-T03 | OrgSession admin tx: add/remove member, change role, update cap | contracts | M | ☐ |
| S9-T04 | Indexer event handlers: org events → `org_sessions`, `org_members` tables | apps/indexer | M | ☐ |
| S9-T05 | Migration: `010_org_sessions.sql` | supabase | S | ☐ |
| S9-T06 | `<OrgManager />` UI: create org, invite member by email/sui_address, set role | apps/web | L | ☐ |
| S9-T07 | Per-member dashboard: shows individual usage within org | apps/web | M | ☐ |
| S9-T08 | Gateway integration: scoped key resolution finds org_session_id; spending_today_atomic decrements per-member | apps/gateway | M | ☐ |
| S9-T09 | RBAC enforcement: viewer can read but not call; member can call within cap; admin can manage | apps/web + apps/gateway | M | ☐ |
| S9-T10 | IP allowlisting per scoped key (gateway-level, simple) | apps/gateway | M | ☐ |
| S9-T11 | Audit log per org with CSV export | apps/web | M | ☐ |
| S9-T12 | E2E test: create org → invite 2 members → each member calls → admin views per-member usage | tests | M | ☐ |

---

# Sprint 10 — Privy / zkLogin Recovery via Social Attestations (July 29 – Aug 4)

**Goal.** B2 — Recoverable embedded wallet auth.

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S10-T01 | `mcpx::recovery::RecoveryGuardians` Move: user designates 2-of-3 trusted Sui addresses | contracts | M | ☐ |
| S10-T02 | Recovery initiation tx: any guardian signals recovery; 48h delay | contracts | M | ☐ |
| S10-T03 | Recovery completion tx: 2-of-3 guardians sign; user's API key + Session control transferred to new auth_id | contracts | M | ☐ |
| S10-T04 | `<GuardianSetup />` UI: pick guardians from contacts/Sui addresses, send invite | apps/web | M | ☐ |
| S10-T05 | `/recover` flow: enter user email/sui_address, request guardian sign-offs | apps/web | M | ☐ |
| S10-T06 | Notification system: emails/push to guardians on recovery request | apps/web | M | ☐ |
| S10-T07 | E2E test: lose Privy access → request recovery → 2 guardians sign → regain control | tests | M | ☐ |

---

# Sprint 11 — On-Chain Bounty Demand Board (Aug 5 – Aug 11)

**Goal.** B3 — Public demand signals with escrow.

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S11-T01 | `mcpx::bounty::Bounty` Move: title, description_blob_id, requirements_blob_id, escrow_balance | contracts | M | ☐ |
| S11-T02 | Bounty contribution tx: anyone can add USDsui to escrow | contracts | S | ☐ |
| S11-T03 | Bounty claim tx: server developer publishes a server matching requirements; arbiter (initially admin multisig) verifies → releases escrow to dev | contracts | M | ☐ |
| S11-T04 | Indexer + migration `011_bounties.sql` | apps/indexer + supabase | M | ☐ |
| S11-T05 | `/bounties` page: list active, "Add to bounty" button per item, "Submit your server" form | apps/web | L | ☐ |
| S11-T06 | Webhook: notify dev when bounty claimed/contributed/closed | apps/web | M | ☐ |
| S11-T07 | Submission verification UI for arbiter (reviews server against bounty requirements) | apps/web | M | ☐ |
| S11-T08 | E2E test: create bounty → 3 contributions → developer publishes matching server → arbiter approves → escrow released | tests | M | ☐ |

---

# Sprint 12 — Auto-Compound Developer Vaults (Aug 12 – Aug 18)

**Goal.** B4 — Sui DeFi load-bearing for developers.

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S12-T01 | `mcpx::vault` extension: `auto_route_config` per vault (lp_protocol, lp_pool_id, threshold, max_slippage_bps) | contracts | M | ☐ |
| S12-T02 | Auto-route execution tx: when accrued balance > threshold, auto-routes to chosen LP (Cetus, Bluefin, Scallop, DeepBook swap) | contracts | L | ☐ |
| S12-T03 | DeepBook integration: swap USDsui → SUI/USDC at vault claim time | contracts | M | ☐ |
| S12-T04 | Cetus integration: deposit USDsui+USDC pair into a Cetus pool from vault | contracts | M | ☐ |
| S12-T05 | Bluefin integration: open USDsui-backed perps position from vault | contracts | M | ☐ |
| S12-T06 | Scallop integration: deposit USDsui to lend at variable yield | contracts | M | ☐ |
| S12-T07 | `<VaultRouting />` UI in dev dashboard: pick auto-route, set threshold, see APY history | apps/web | L | ☐ |
| S12-T08 | Vault P&L view (accrued + LP earnings - slippage) | apps/web | M | ☐ |
| S12-T09 | Indexer: VaultAutoRouted, VaultRoutingChanged events | apps/indexer | M | ☐ |
| S12-T10 | E2E test: dev sets auto-route to Scallop → 5 calls accrue → auto-claim threshold met → routed to Scallop → balance shows in Scallop | tests | M | ☐ |

---

# Sprint 13 — Telegram / Discord MCP Bots (Aug 19 – Aug 25)

**Goal.** B5 — Chat-app entry to MCP.

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S13-T01 | `apps/bots/telegram/`: telegram-bot listening for `/call <server> <tool> <args>` | apps/bots | L | ☐ |
| S13-T02 | Telegram OAuth → Privy embedded wallet derivation per tg user_id | apps/bots | M | ☐ |
| S13-T03 | Per-user Session creation (auto first time) via tg-funded faucet for first $0.50 | apps/bots | M | ☐ |
| S13-T04 | Discord version: same flow with discord OAuth | apps/bots | L | ☐ |
| S13-T05 | Marketplace server detail page: "Try in Telegram" / "Try in Discord" buttons that deep-link to the bot | apps/web | M | ☐ |
| S13-T06 | Bot rate limits + abuse detection | apps/bots | M | ☐ |
| S13-T07 | Receipt link in bot reply (suiscan + walrus blob viewer) | apps/bots | S | ☐ |
| S13-T08 | E2E test: send `/call walrus-search query "foo"` from tg → result in <5s | tests | M | ☐ |
| S13-T09 | Documentation: "Use MCPX from chat" guide | apps/docs | M | ☐ |

---

# Sprint 14 — Token-Gated MCP Servers (Aug 26 – Sep 1)

**Goal.** B6 — Token-/NFT-gated access.

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S14-T01 | `mcpx::registry::Server` extension: `gate_object_type: Option<TypeName>`, `gate_min_balance: u64` | contracts | S | ☐ |
| S14-T02 | Gateway pre-flight: if server has gate, query caller's address for matching object type + balance via Sui RPC | apps/gateway | M | ☐ |
| S14-T03 | Marketplace UI: gated servers show "Requires X" badge; "Check eligibility" button | apps/web | M | ☐ |
| S14-T04 | Server publishing: optional gate config in `mcpx.config.json` and CLI publish | cli | S | ☐ |
| S14-T05 | Documentation: "Token-gating your MCP server" guide | apps/docs | M | ☐ |
| S14-T06 | E2E test: publish gated server with NFT requirement → uneligible user fails → eligible user succeeds | tests | M | ☐ |

---

# Sprint 15 — Cross-Chain Payouts (Sep 2 – Sep 8)

**Goal.** B7 — Earn on Sui, paid anywhere.

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S15-T01 | Wormhole SDK + DeepBook integration audit | contracts | M | ☐ |
| S15-T02 | `mcpx::vault::set_payout_chain(chain_id, address, token_type)` | contracts | M | ☐ |
| S15-T03 | Payout claim tx: instead of withdrawing USDsui, swaps to chosen token + bridges via Wormhole to chosen chain/address | contracts | XL | ☐ |
| S15-T04 | Supported chains for v1: Sui (native), Base (USDC via Wormhole), Solana (USDC via Wormhole) | contracts | L | ☐ |
| S15-T05 | Slippage protection + max gas budget per claim | contracts | M | ☐ |
| S15-T06 | `<PayoutChainConfig />` UI in dev dashboard | apps/web | M | ☐ |
| S15-T07 | Cross-chain claim status tracking (Wormhole guardian observation, finality) | apps/web + apps/indexer | M | ☐ |
| S15-T08 | Refund flow if cross-chain bridge fails post-source-burn | contracts | M | ☐ |
| S15-T09 | Documentation: "Get paid in your favorite chain" guide | apps/docs | M | ☐ |
| S15-T10 | E2E testnet: dev claims with payout-chain=Base → USDC arrives in Base address | tests | L | ☐ |
| S15-T11 | Mainnet rollout post audit + small-cap test claims | rollout | M | ☐ |

---

## Phase 4 — Tier C: Long-game defensibility (Sprints 16–20)

# Sprint 16 — On-Chain Reviews + CallReceipts as Composable Trust (Sep 9 – Sep 15)

**Goal.** C1 — Reviews ship on-chain (per ADR-007); CallReceipts become a public reputation primitive (ADR-010).

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S16-T01 | `mcpx::review::Review` Move: server_id, reviewer_address, rating (1-5), text_blob_id, created_at | contracts | M | ☐ |
| S16-T02 | Review eligibility check on creation: must have ≥N CallReceipts from this server (anti-spam) | contracts | M | ☐ |
| S16-T03 | Review update tx (within 30 days of creation) | contracts | S | ☐ |
| S16-T04 | Migration `012_reviews_onchain.sql`: schema for indexer mirror | supabase | S | ☐ |
| S16-T05 | Indexer: ReviewPosted, ReviewUpdated, ReviewDeleted events | apps/indexer | M | ☐ |
| S16-T06 | Migration of legacy reviews (if any from web2): on-chain copy with attestor=admin signed | scripts | S | ☐ |
| S16-T07 | `<ReviewForm />` and `<ReviewList />` UI updated to read on-chain reviews + write Move tx via wallet | apps/web | L | ☐ |
| S16-T08 | Public CallReceipt history endpoint: `GET /api/v1/agents/{address}/receipts` (returns lifetime + per-server stats) | apps/web | M | ☐ |
| S16-T09 | Reputation widget: any other Sui app can fetch and display "X has Y CallReceipts via mcpxgg" | packages/sdk-client | M | ☐ |
| S16-T10 | Documentation: "Using mcpxgg as a reputation oracle" guide for third-party Sui apps | apps/docs | M | ☐ |
| S16-T11 | E2E test: post review → verify on-chain → other app reads via SDK | tests | M | ☐ |

---

# Sprint 17 — Server Marketplace Forks (Sep 16 – Sep 22)

**Goal.** C2 — Open-source the marketplace UI for vertical communities.

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S17-T01 | Extract `apps/web` skeleton into a fresh `templates/marketplace/` package: Privy connect + chain queries + UI but no curation | templates | L | ☐ |
| S17-T02 | Curation config: `marketplace.config.json` with category filters, server allowlist/denylist, custom branding | templates | M | ☐ |
| S17-T03 | License the template under Apache 2.0; publish on GitHub | templates | S | ☐ |
| S17-T04 | First fork example: "DeFi-only mcpxgg" hosted at `defi.mcpx.gg` | hosting | M | ☐ |
| S17-T05 | Documentation: "Run your own MCPX marketplace" guide | apps/docs | L | ☐ |
| S17-T06 | Telemetry: forks can opt-in to send anonymized usage data back to canonical mcpxgg | templates | S | ☐ |

---

# Sprint 18 — Per-Call Privacy Proofs (Seal + ZK) (Sep 23 – Sep 29)

**Goal.** C3 — Privacy-preserving compute attestation.

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S18-T01 | Threat model + privacy spec write-up | docs | M | ☐ |
| S18-T02 | `packages/walrus/seal.ts` extension: per-call ephemeral key + circuit input commitment | packages/walrus | L | ☐ |
| S18-T03 | Server SDK wrapper: `tool.handler` can opt into "private mode"; SDK seal-encrypts inputs to deterministic key | packages/sdk-server | L | ☐ |
| S18-T04 | Move: `mcpx::settlement::CallReceipt` extension with `inputs_commitment: vector<u8>` | contracts | M | ☐ |
| S18-T05 | Receipt viewer: shows commitment + verification link (off-chain ZK verifier service) | apps/web | M | ☐ |
| S18-T06 | First production server using private mode: `sui-identity` for KYC-like queries | servers/sui-identity | M | ☐ |
| S18-T07 | E2E test: private call returns result; receipt has commitment; off-chain verify passes | tests | M | ☐ |
| S18-T08 | Documentation: "Building private MCP servers" guide | apps/docs | M | ☐ |

---

# Sprint 19 — Open Agent Registry (Sep 30 – Oct 6)

**Goal.** C4 — Verifiable agent identity + tiered pricing.

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S19-T01 | `mcpx::agent::Agent` Move: address, owner, name_blob_id, total_calls, lifetime_volume_atomic, tier | contracts | M | ☐ |
| S19-T02 | Agent registration tx; tier auto-promotes at thresholds (Bronze → Silver → Gold) | contracts | M | ☐ |
| S19-T03 | Tiered pricing in `settle_call`: Gold gets 5% discount on take rate (configurable) | contracts | M | ☐ |
| S19-T04 | Agent SDK: `createAgent({ name, owner })` writes registration; gateway recognizes agent header | packages/sdk-client | M | ☐ |
| S19-T05 | Agent dashboard at `/agents/[address]`: profile, lifetime stats, current tier | apps/web | M | ☐ |
| S19-T06 | Marketplace integration: filter "Trusted agents" toggle; show agent tier on usage rows | apps/web | M | ☐ |
| S19-T07 | E2E test: register agent → make 100 calls → tier auto-promotes → verify discount applied | tests | M | ☐ |

---

# Sprint 20 — MCP Fork Detection / Compatibility Matrix (Oct 7 – Oct 13)

**Goal.** C5 — Future-proof against MCP standard fragmentation.

| ID | Task | Component | Effort | Status |
|---|---|---|---|---|
| S20-T01 | Indexer: weekly probe of every active server → publishes `mcp_capabilities` snapshot | apps/indexer | M | ☐ |
| S20-T02 | `mcpx::quality::CapabilityAttestation` Move: server_id, mcp_dialects (e.g., "anthropic-1.5", "openai-experimental"), period | contracts | M | ☐ |
| S20-T03 | Marketplace: "Compatibility" badge per server (Anthropic, OpenAI, Google) | apps/web | M | ☐ |
| S20-T04 | Setup wizard adapts: per client, only show compatible servers | apps/web | M | ☐ |
| S20-T05 | Documentation: "MCP compatibility on mcpxgg" reference | apps/docs | M | ☐ |

---

## Appendix A — Submission checklist (per hackathon handbook)

| Item | Status | Owner | Sprint |
|---|---|---|---|
| Project Name: mcpxgg / mcpx.gg | ☐ | — | S0 |
| Description | ☐ | — | S8 |
| Logo (1:1) | ☐ | — | S0 |
| Public GitHub: monorepo | ☐ | — | S0 |
| Demo Video (≤5 min) | ☐ | — | S8 |
| Website live: mcpx.gg | ☐ | — | S4 |
| Deployment: Mainnet | ☐ | — | S5 |
| Move Package ID | ☐ | — | S5 |
| x402 Facilitator URL | ☐ | — | S2 |
| 5 anchor servers live | ☐ | — | S6 |

---

## Appendix B — Spreadsheet export

The sub-task tables above are markdown but mirror a flat schema:

```
sprint_id, task_id, task, component, effort, status, blocked_by, owner
S0, S0-T01, "Initial monorepo scaffold", repo, M, done, none, raj
S0, S0-T02, "Create empty private GitHub repo", repo, S, todo, none, raj
...
```

To export to a spreadsheet:
```bash
node scripts/sprints-to-csv.js > sprints.csv  # to be written in Sprint 0 if needed
```

Until then, copy any sprint table into Notion / Linear / Sheets — column headers map directly.

---

## Appendix C — Tier A/B/C cross-reference

| Tier | Item | Sprint(s) | Sub-tasks |
|---|---|---|---|
| A1 | Spending Intents | 6 | S6-T01..08 |
| A2 | Pay-per-Output Streaming | 7 | S7-T01..06 |
| A3 | SLA Staking + Auto-Slash | 7 | S7-T07..13 |
| A4 | Treasury Insurance Pool | 7 | S7-T14..19 |
| A5 | Composable Bundles | 5 | S5-T15..20 |
| A6 | Embeddable Widgets | 7 | S7-T20..26 |
| B1 | Multi-Tenant Org Sessions | 9 | S9-T01..12 |
| B2 | Privy/zkLogin Recovery | 10 | S10-T01..07 |
| B3 | On-Chain Bounty Demand Board | 11 | S11-T01..08 |
| B4 | Auto-Compound Developer Vaults | 12 | S12-T01..10 |
| B5 | Telegram/Discord MCP Bots | 13 | S13-T01..09 |
| B6 | Token-Gated MCP Servers | 14 | S14-T01..06 |
| B7 | Cross-Chain Payouts | 15 | S15-T01..11 |
| C1 | On-Chain Reviews + CallReceipts as Trust | 16 | S16-T01..11 |
| C2 | Marketplace Forks | 17 | S17-T01..06 |
| C3 | Per-Call Privacy Proofs | 18 | S18-T01..08 |
| C4 | Open Agent Registry | 19 | S19-T01..07 |
| C5 | MCP Fork Detection | 20 | S20-T01..05 |
