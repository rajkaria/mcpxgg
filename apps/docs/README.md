# mcpxgg Docs

Public documentation site for mcpxgg. **Sprint 8** (`docs/SPRINTS.md`) fills this out as a Nextra/Fumadocs project.

## Pages planned

- Home / quickstart
- Setup guides per AI client (Cursor, Claude Desktop, Windsurf, Cline)
- Recipes — build an MCP server, embed `<mcpx-call>`, integrate the SDK
- API reference for `@mcpxgg/sdk` and `@mcpxgg/server`
- x402 Sui scheme reference
- ADRs mirror (read-only of `/docs/DECISIONS.md`)
- Changelog
- Blog

## Published content

Until the Sprint 8 site framework lands, finished reference docs live as
markdown under `content/`:

- [`content/mcpx-config-schema.md`](./content/mcpx-config-schema.md) —
  full `mcpx.config.json` schema reference (S5-T13): every field, the
  `priceAtomic` USDsui 6-decimal convention, `freeTierCallsPerUser`, and an
  annotated example.
- [`content/building-an-autonomous-agent.md`](./content/building-an-autonomous-agent.md) —
  "Building an autonomous agent that uses MCPX" (S6-T08): create a
  `SpendingIntent`, drive paid calls with `@mcpxgg/sdk`
  `client.callTool(..., { intentId })`, observe `IntentUsed`, and handle
  revocation.
- [`content/embed.md`](./content/embed.md) — "Embed MCPX anywhere with
  `<mcpx-call>`" (S7-T24): route `embed`. One-tag CDN embed, npm install,
  attributes, CSS-custom-property theming, Privy/wallet fallback, and the
  committed third-party demo page.
