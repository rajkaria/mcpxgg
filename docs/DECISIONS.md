# Architecture Decision Records

Locked-in choices for MCPX. Each entry: decision, context, rationale, alternatives considered, status.

Don't relitigate without writing a new ADR superseding the old one.

---

## ADR-001 — Sui as the launch chain

**Status:** Accepted

**Decision.** Build Sui-native first. Multi-chain via adapters later.

**Rationale.** Sui is in x402 spec but has no production application layer. Coinbase Agent.market on Base; nothing equivalent on Sui. Strategic gap that Sui Foundation needs filled. USDsui (gas-free) + PTBs (atomic multi-call) + Walrus (permanent storage) + Seal (encryption) + zkLogin = unique stack.

**Alternatives.** Base (saturated); Solana (no equivalent stablecoin gas-free transfers); EVM L2s (require multi-tx settlement vs Sui's single PTB).

---

## ADR-002 — Monorepo with pnpm + Turborepo

**Status:** Accepted

**Decision.** Single repo, pnpm workspaces, Turborepo for task orchestration.

**Rationale.** 7+ deployable units (Move package, facilitator, indexer, gateway, web, CLI, 5 anchor servers, 2 SDK packages) sharing types/schema. Multi-repo = copy-paste types or premature npm publishing. Turbo gives incremental builds and remote caching.

**Alternatives.** Nx (heavier), Bun workspaces (less mature), separate repos (rejected).

---

## ADR-003 — Privy for wallet + social login

**Status:** Accepted

**Decision.** Use Privy (`@privy-io/react-auth` + `@privy-io/server-auth`) as the primary auth + wallet layer. Supports Google / Apple / email / Twitter / Discord login, embedded wallets that derive a Sui address, and external wallet connect (Suiet, Slush) for power users.

**Rationale.** Spec called for zkLogin + Suiet/Slush; Privy bundles both behind a single SDK with better UX, recovery flows, and session management. Privy supports Sui natively. We get the "feels like Web2" sign-in without writing zkLogin glue ourselves.

**Cost.** Free tier covers early MAU; usage-priced after that — fine for hackathon.

**Alternatives.** Raw zkLogin (more work), Dynamic.xyz (less Sui maturity), web3auth (heavier).

---

## ADR-004 — 2.5% take rate, configurable on-chain

**Status:** Accepted

**Decision.** Default platform take rate **2.5%** of every settled call. **0.5% routed to `InsurancePool`**, **2.0% to `PlatformTreasury`**. Both percentages stored in a `PlatformConfig` shared object, mutable only by admin multisig. Developer share = 97.5% net of insurance, paid into `DeveloperVault`.

**Rationale.** Funds (a) treasury for ops + bootstrap subsidies + Sui Foundation alignment, (b) insurance pool for SLA payouts (see ADR-009). Still beats Web2 SaaS (Stripe Connect was 70-85% to dev) and Coinbase Agent.market (~85-90%). Configurability protects against future market conditions.

**Alternatives.** 1% (too thin given insurance carve-out); 5% (politically risky for first-mover positioning). Insurance pool: optional sidecar (rejected — wanted economic safety as a default).

---

## ADR-005 — Permanent Walrus retention for all receipts

**Status:** Accepted

**Decision.** Every `CallReceipt` and the Walrus blob it references is **retained permanently**. No automatic expiry on receipts, metadata blobs, or quality metrics.

**Rationale.** Receipts compose with future trust primitives (ADR-010 / Sprint 16). A 90-day TTL would break composability. Walrus pricing per blob is small enough that even at 100k calls/day, annual storage is bounded.

**Cost note.** Estimate 1–4 KB per receipt blob. At 365k calls/year × 4 KB × $0.001/KB-year ≈ $1.5/year per anchor server. Negligible.

**Alternatives.** 90-day TTL on full payloads (rejected — kills trust composability); selective retention by call value (rejected — operational complexity).

---

## ADR-006 — Apache 2.0 license for facilitator and SDKs

**Status:** Accepted

**Decision.** `apps/facilitator/`, `packages/sdk-client/`, `packages/sdk-server/`, `packages/x402/` ship under Apache 2.0. The rest of the monorepo stays private until product launch.

**Rationale.** Apache 2.0 is corporate-friendly (explicit patent grant) — important for x402 Foundation upstreaming and for getting the facilitator listed as canonical Sui implementation. MIT is shorter but lacks patent provisions some adopters require.

**Alternatives.** MIT (rejected — patent ambiguity), GPL (rejected — incompatible with commercial use cases on the developer side), BSD-2 (acceptable but less precedent in the x402/Mysten ecosystem).

---

## ADR-007 — Reviews on-chain (deferred to Sprint 16)

**Status:** Accepted

**Decision.** Reviews are written as on-chain Move objects (`Review { server_id, reviewer, rating, blob_id }`) with the review text on Walrus. Until Sprint 16, the existing Web2 reviews table in Postgres is read-only and indexes any reviews from the legacy build (none yet).

**Rationale.** Per user direction, on-chain reviews ship later. Composability with `CallReceipt`-derived reputation (ADR-010) is the win.

**Mitigation for sprint timing.** Spec said "reviews on Postgres for hackathon" — we keep that mechanic disabled in the hackathon scope; first reviews land in Sprint 16.

**Alternatives.** Postgres-only reviews forever (rejected — can be censored, doesn't compose); hybrid (rejected — extra complexity).

---

## ADR-008 — Bootstrap subsidy: $1.00 USDsui per phone-verified user

**Status:** Accepted

**Decision.** Every newly-signed-up user who completes Twilio phone verification receives **1.00 USDsui** (1,000,000 atomic units, 6 decimals) as a one-time treasury-funded grant to their Session. Cap monthly outflow via `BOOTSTRAP_SUBSIDY_MONTHLY_BUDGET_ATOMIC`.

**Rationale.** Without this, a brand-new user has to: connect wallet → buy USDsui on an exchange → bridge to Sui → deposit to Session → only then call a tool (5 steps before value). With the subsidy: connect (or social-login via Privy) → call. Try first, pay later. $1.00 funds 100–500 calls at typical anchor-server pricing — enough to demonstrate value and convert. Phone-verify gates against sybil farming.

**Alternatives.** $0.50 (less convincing trial); $2.00 (higher CAC, similar conversion delta); free unlimited (rejected — abuse).

**Funding.** Initial treasury seeded from founder/team capital (~$5K), refilled from take rate (ADR-004) post-launch.

---

## ADR-009 — SLA staking + auto-slash for quality

**Status:** Accepted (build target: Sprint 7)

**Decision.** Developers may optionally stake USDsui as collateral against an uptime/quality promise. If the off-chain quality oracle observes uptime drop below the developer's stated SLA tier, the stake auto-slashes proportionally and the slashed amount routes to the `InsurancePool` for affected-user refunds.

**Rationale.** Quality scores without economic backing are vibes. Staking makes them real and creates a "skin in the game" signal for buyers. Replaces the spec's manual oracle attestation with an economically secured oracle.

**Constraints.** Slashing must be tied to verifiable on-chain or attested off-chain metrics. Initial implementation: oracle-attested, multi-sig-gated slashing. Future: decentralized attestor quorum.

**Alternatives.** Insurance pool only (rejected — no developer-side accountability); no SLA mechanism (rejected — leaves quality untrustworthy).

---

## ADR-010 — CallReceipts as composable trust primitives

**Status:** Accepted (build target: Sprint 16)

**Decision.** Every `CallReceipt` Move object is permanent and queryable. Other Sui apps can read a user's or agent's receipt history and use it to gate access, drive reputation scores, or unlock pricing tiers.

**Rationale.** Turns mcpx into an identity/reputation substrate for the broader Sui agent commerce ecosystem — beyond just being a marketplace. Combined with permanent Walrus retention (ADR-005), this is a defensible long-term moat.

**Alternatives.** Reputation in a sidecar database (rejected — non-portable, censorable).

---

## ADR-011 — Indexer mirror, not source of truth

**Status:** Accepted

**Decision.** Supabase Postgres holds **only** what the indexer hydrates from Sui events. The web app reads from Postgres for speed; writes always sign Move txs that the indexer later observes.

**Rationale.** Marketplace browse needs 10ms response — chain reads can't do that. But if Postgres ever diverges from chain, chain wins; the indexer can replay any range to re-hydrate. Eliminates the "two sources of truth" trap.

**Operational rule.** No HTTP route handler writes to `mcp_servers`, `request_log`, `developer_vaults`, or `chain_balances` directly. They write to chain; the indexer eventually-consistent-syncs.

---

## ADR-012 — Facilitator self-hosted at facilitator.mcpx.gg + OSS Apache 2.0 day 1

**Status:** Accepted

**Decision.** We host the canonical Sui x402 facilitator at `facilitator.mcpx.gg`. The full source ships open under Apache 2.0 from launch day so anyone can self-host. Coordinate with x402 Foundation on upstreaming as the canonical Sui implementation post-mainnet.

**Rationale.** Hosting it ourselves guarantees uptime for our own marketplace; OSS-from-day-1 prevents us from being a single point of failure for the Sui agent commerce ecosystem and aligns us with Sui Foundation strategic interests.

**Operational.** Run on Fly.io with multi-region. Use Sui's gas-station pattern: facilitator pays gas, recovers from treasury.

**Alternatives.** Closed-source (rejected — political non-starter for upstreaming); community-only hosting (rejected — fragile bootstrap).

---

## ADR-013 — Watchdog / Pulse / Sonar fate: deferred decision

**Status:** Open — to be decided after mcpxgg infrastructure is built

**Context.** Three first-party Web2 MCP servers (Watchdog, Pulse, Sonar) exist in the legacy build. They're not anchor servers in the new spec.

**Options.** (a) republish all three as Sui-paid external servers, (b) sunset them, (c) refactor into the anchor server style. Decide after Sprint 6 when the platform itself is mainnet.

---

## ADR-014 — No token at hackathon

**Status:** Accepted

**Decision.** No `$MCPX` token at hackathon launch. Revenue in stablecoins from day one.

**Rationale.** Token introduces regulatory complexity, distraction, and vesting cliffs. We have a real fee-based business model on day 1.

**Future.** Governance token possible if community demand and clear utility (e.g., quality oracle staking, voting on take rate changes). Not before audit + demonstrated PMF.
