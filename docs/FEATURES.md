# Platform Feature Additions (beyond core spec)

19 high-utility additions that extend the canonical `MCPX-SUI-SPEC.md`. Each one is mapped to a sprint in `SPRINTS.md` and a sub-task ID for tracking.

Tier A is hackathon-scope (build for Demo Day). Tier B is post-hackathon Month 1–2. Tier C is long-game defensibility.

---

## Tier A — Hackathon scope (Sprints 5–7)

### A1 — Agent Spending Intents
**Sprint 6** • Move + apps/web

A new `mcpx::intent::SpendingIntent` Move object that lets a user delegate budgets to specific agent addresses with on-chain enforceable policies: "agent X may spend up to $Y per day on category Z, expiring at T." Agents call autonomously within the policy; gateway checks the intent before settling.

**Why it matters.** Spec lets users pay per call. This lets users delegate budgets to agents — the missing primitive in Coinbase Agent.market and the obvious next step from x402 V2 sessions.

**Sub-task IDs:** S6-T01 to S6-T08.

### A2 — Pay-per-Output Streaming (x402 `upto` scheme)
**Sprint 7** • apps/facilitator + apps/gateway

For long-running tools (LLM inference, large analyses), settle in chunks via the x402 `upto` scheme. Refund unused on early abort.

**Why it matters.** Without this, the platform can't host the most important class of MCP server (AI inference). Spec defers as edge case — we don't.

**Sub-task IDs:** S7-T01 to S7-T06.

### A3 — MCP Server SLA Staking + Auto-Slash
**Sprint 7** • Move + indexer

`mcpx::staking::ServerStake` Move object. Developer optionally stakes USDsui as collateral against a stated SLA tier. Quality oracle observes uptime / error rate; if metrics breach, stake auto-slashes proportionally and routes to InsurancePool.

**Why it matters.** Quality scores without economic backing are vibes. This makes them real. Demo line: "I staked $100 against 99% uptime — slash me if I fail."

**Sub-task IDs:** S7-T07 to S7-T13.

### A4 — Treasury Insurance Pool
**Sprint 7** • Move + apps/web

`mcpx::insurance::InsurancePool` shared object that receives 0.5% of every call (out of the 2.5% take rate per ADR-004). Auto-pays out to any user whose call hit a server during a measured downtime window. SLA-staking slashed funds also route here.

**Why it matters.** Real consumer protection. No equivalent in agent commerce. Trust pillar of the demo.

**Sub-task IDs:** S7-T14 to S7-T19.

### A5 — Composable Bundles (Sui Object Groups)
**Sprint 5** • Move + apps/web

`mcpx::bundle::Bundle` shared object referencing `vector<ID>` of servers + a per-call price multiplier. "Marketing toolkit", "DeFi research toolkit" — curated by us; later by community. One-click enable.

**Why it matters.** Solves the cold-start "which servers should I enable" problem. Composable like Sui display objects.

**Sub-task IDs:** S5-T15 to S5-T20.

### A6 — Embeddable Widgets (`<mcpx-call>`)
**Sprint 7** • packages/widget (new)

Drop-in web component with bundled wallet UI. `<mcpx-call server="walrus-search" tool="query" prefill='{"query":"..."}' />` handles wallet connect (via Privy) + payment + result rendering.

**Why it matters.** This is how mcpxgg propagates virally. Every sample tweet, every README example, every Sui dApp embedding agent capabilities becomes a discovery surface.

**Sub-task IDs:** S7-T20 to S7-T26.

---

## Tier B — Month 1–2 post-hackathon (Sprints 9–15)

### B1 — Multi-Tenant Org Sessions
**Sprint 9** • Move + apps/web

`mcpx::session::OrgSession` with sub-keys per team member, on-chain spending policies per role (admin / member / viewer / billing-only). Budget enforcement is on-chain — no admin can hide or alter spending.

**Sub-task IDs:** S9-T01 to S9-T12.

### B2 — Privy / zkLogin Recovery via Social Attestations
**Sprint 10** • Move + apps/web

2-of-3 trusted Sui addresses can attest a recovery, regenerating Privy session for the user.

**Sub-task IDs:** S10-T01 to S10-T07.

### B3 — On-Chain Bounty Demand Board
**Sprint 11** • Move + apps/web

`mcpx::bounty::Bounty` shared object. Users escrow USDsui for "I want an MCP server for X." First dev who publishes a server matching spec wins the pool.

**Sub-task IDs:** S11-T01 to S11-T08.

### B4 — Auto-Compound Developer Vaults
**Sprint 12** • Move + apps/web

Earnings auto-route into Cetus / Bluefin LP, Scallop yield, or auto-swap to USDC / SUI via DeepBook. Developer dashboard becomes a Sui DeFi onramp.

**Sub-task IDs:** S12-T01 to S12-T10.

### B5 — Per-Server Telegram / Discord Bots
**Sprint 13** • new apps/bots/

Bot that lets you call any server's tool from chat. Wallet bound by tg/discord OAuth + Privy embedded wallet.

**Sub-task IDs:** S13-T01 to S13-T09.

### B6 — Token-Gated MCP Servers
**Sprint 14** • Move

Server can require holding a specific Sui object (NFT, fungible token, soulbound credential) to call. Enables membership tools, alumni networks, contributor-only toolchains.

**Sub-task IDs:** S14-T01 to S14-T06.

### B7 — Cross-Chain Payouts
**Sprint 15** • Move + apps/web + Wormhole integration

Developer earns in USDsui, pre-sets payout chain (USDC on Base, SOL on Solana). Auto-bridge via Wormhole / cross-chain DEX.

**Sub-task IDs:** S15-T01 to S15-T11.

---

## Tier C — Long-game defensibility (Sprints 16–20)

### C1 — On-Chain Reviews + CallReceipts as Composable Trust
**Sprint 16** • Move

Two changes:
- Reviews land on-chain via `mcpx::review::Review` Move object (per ADR-007); review text on Walrus.
- Other Sui apps can read a user's or agent's `CallReceipt` history and use it to gate access ("must have called walrus-search 100+ times"). Mcpxgg becomes an identity / reputation substrate for agent commerce.

**Sub-task IDs:** S16-T01 to S16-T11.

### C2 — Server Marketplace Forks (open-source UI)
**Sprint 17** • apps/web → public template

Open-source `apps/web` so anyone can run a niche marketplace ("DeFi-only", "vibe-coded games", etc.) with their own curation. Settlement still flows through canonical mcpxgg contracts.

**Sub-task IDs:** S17-T01 to S17-T06.

### C3 — Per-Call Privacy Proofs (Seal + ZK)
**Sprint 18** • packages/walrus extensions + Move

Server can prove "I returned a result computed from inputs without revealing inputs to anyone" — useful for agents handling KYC, medical, financial data.

**Sub-task IDs:** S18-T01 to S18-T08.

### C4 — Open Agent Registry
**Sprint 19** • Move

Agents register on-chain, accumulate reputation per CallReceipt, unlock "trusted agent" pricing tiers (volume discounts, priority routing, lower take rate).

**Sub-task IDs:** S19-T01 to S19-T07.

### C5 — MCP Fork Detection / Compatibility Matrix
**Sprint 20** • indexer + apps/web

Per-server attestation: "this server speaks MCP-Anthropic v1.5, MCP-OpenAI experimental." Indexer reads from server probes; clients filter compatible servers by client. Future-proofs against MCP standard fragmentation.

**Sub-task IDs:** S20-T01 to S20-T05.

---

## Cross-cutting principles enforced across all features

- **Multi-chain ready.** Every new feature touches `packages/chain` first; Sui-specific code goes only in `sui-adapter.ts`.
- **Atomic settlement preserved.** Any feature that touches the payment path must fit in a single PTB or have a documented multi-PTB fallback.
- **Permanent receipts.** All settlement events produce a permanent `CallReceipt` + Walrus blob.
- **Indexer mirror, not source of truth.** No HTTP route writes to chain-mirrored tables; all writes go through Move tx → events → indexer.
- **On-chain configurability.** Take rate, insurance bps, subsidy amount, SLA stake minimums all stored in `PlatformConfig` shared object; mutable via admin multisig only.
