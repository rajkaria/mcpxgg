# MCPX

**On-chain MCP marketplace, settled in stablecoins on Sui.**

The agentic commerce platform native to Sui — every MCP tool call settles on-chain in USDsui, every receipt is verifiable on Walrus, and every developer earns directly to their Sui wallet.

- **Marketplace + dashboard:** [mcpx.gg](https://mcpx.gg)
- **Gateway:** mcp.mcpx.gg
- **x402 facilitator:** facilitator.mcpx.gg (open-source, Apache 2.0)

---

## What's in this monorepo

```
mcpxgg/
├── apps/
│   ├── web/                 # mcpx.gg — Next.js 16 (App Router) + Privy + Tailwind v4 + shadcn
│   ├── gateway/             # mcp.mcpx.gg — JSON-RPC gateway, auth → settle → forward
│   ├── facilitator/         # x402 Sui facilitator (/verify, /settle, /supported)
│   ├── indexer/             # Sui events → Postgres views (Supabase mirror)
│   └── docs/                # Public docs site
├── contracts/               # Move package: registry, session, settlement, vault, treasury, access, quality, intent, staking, insurance, bundle, events, admin
├── packages/
│   ├── chain/               # ChainAdapter interface + SuiAdapter (multi-chain ready)
│   ├── sdk-client/          # @mcpxgg/sdk — for agent / MCP consumers
│   ├── sdk-server/          # @mcpxgg/server — for developers building servers
│   ├── walrus/              # Walrus + Seal client wrapper
│   ├── x402/                # x402 spec types and Sui scheme client
│   ├── ui/                  # shared shadcn primitives
│   └── shared/              # supabase, cache, twilio, validation, errors, types
├── servers/                 # First-party anchor MCP servers (added in sprints 3-6)
├── cli/                     # npx mcpxgg publish — uploads to Walrus + signs Move tx
├── starter-template/        # Forkable scaffold for external developers (Sui-aware)
├── supabase/migrations/     # Indexer mirror schema
├── docs/                    # SPRINTS.md, DECISIONS.md, ARCHITECTURE.md, REUSE-MAP.md, FEATURES.md
└── scripts/                 # one-off ops scripts (migration, deploy)
```

## Quick start

```bash
# Install pnpm if you don't have it
corepack enable
corepack prepare pnpm@9.15.0 --activate

# Install deps for entire workspace
pnpm install

# Copy env template (you fill in real values)
cp .env.example .env.local

# Run only the web app
pnpm --filter @mcpxgg/web dev

# Run everything in parallel (web + gateway + facilitator + indexer)
pnpm dev
```

## Sprint plan

The full execution plan with sub-tasks, owners, and definitions of done is in **[docs/SPRINTS.md](docs/SPRINTS.md)**.

- **Sprint 0** is foundation work (this scaffold + spikes + decisions)
- **Sprints 1–6** are hackathon scope, mainnet by **June 21, 2026**
- **Sprints 7–8** are polish + Tier A differentiators + Demo Day (July 20–21, 2026)
- **Sprints 9–20** are post-hackathon Tier B and Tier C features

## Key decisions

See **[docs/DECISIONS.md](docs/DECISIONS.md)** for the locked-in choices: 2.5% take rate (configurable), permanent Walrus retention, Privy for auth, Apache 2.0 facilitator license, on-chain reviews scheduled for Sprint 16.

## Architecture

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for a layered view of the platform: surfaces → gateway → chain abstraction → facilitator + indexer → Sui mainnet.

## What was reused from the Web2 build

See **[docs/REUSE-MAP.md](docs/REUSE-MAP.md)** for a file-by-file mapping. ~70% of the frontend, gateway dispatcher, schema validation, auth, and Twilio are carried over verbatim and rebound to chain primitives.

## License

Repository: private (private GitHub repo until launch).
Facilitator (`apps/facilitator/`) and SDKs (`packages/sdk-*`): Apache 2.0 — see each package's LICENSE.
