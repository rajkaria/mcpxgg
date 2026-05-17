# @mcpxgg/docs

The public documentation site for MCPX — **docs.mcpx.gg**. Built with
[Fumadocs](https://fumadocs.dev) on Next.js 16 (App Router, React 19).
Stood up in Sprint 8 (S8-T05 / S8-T15).

## Develop

```bash
pnpm --filter @mcpxgg/docs dev      # http://localhost:3030
pnpm --filter @mcpxgg/docs build    # production build (webpack)
pnpm --filter @mcpxgg/docs typecheck
```

> The build uses `next build --webpack`. Next 16 defaults to Turbopack,
> but `fumadocs-mdx@15` ships an ESM webpack loader that Turbopack's
> webpack-loader bridge cannot `require()`; the webpack builder runs it
> correctly. Revisit when fumadocs-mdx ships a Turbopack-native loader.

`fumadocs-mdx` runs on `postinstall` and regenerates `.source/` (the
typed content index) from `source.config.ts`. Re-run `npx fumadocs-mdx`
in `apps/docs` after adding or moving content files.

## Content layout

All site content is MDX under `content/`:

- `content/docs/` — the documentation tree. Ordering is controlled by
  `meta.json` files. Sections: **Home**, **Quickstart** (5-min user +
  5-min developer), **Core concepts** (Sessions, Vaults, Receipts,
  Intents, Bundles, Insurance, SLA Staking, streaming), **SDK reference**
  (`@mcpxgg/sdk`, `@mcpxgg/server`, `@mcpxgg/widget` — derived from each
  package's real `src/index.ts`), **x402 facilitator spec**, **Move
  package reference** (all 13 modules), **Recipes** (build an autonomous
  agent, embed a tool, run your own marketplace).
- `content/blog/` — announcement posts. First post:
  `mcpx-is-mainnet-on-sui.mdx` (S8-T12).

The earlier standalone reference docs have been folded into the site:

- `mcpx-config-schema.md` → `content/docs/recipes/run-your-own-marketplace.mdx`
- `building-an-autonomous-agent.md` → `content/docs/recipes/autonomous-agent.mdx`
- `embed.md` → `content/docs/recipes/embed-a-tool.mdx`

The originals are retained under `content/*.md` for history and any
external links; they are not part of the built site (only `content/docs`
and `content/blog` are scanned).

## Accuracy policy

SDK / x402 / Move references are derived by reading the actual source
(`packages/sdk-client`, `packages/sdk-server`, `packages/widget`,
`packages/x402`, `apps/facilitator`, `contracts/sources/*.move`). Update
these docs when those surfaces change — do not invent signatures.
