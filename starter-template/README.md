# MCPX MCP Server Starter Template

Build and deploy MCP (Model Context Protocol) servers for the MCPX platform. This template gives you everything you need to create tools that AI assistants can call over HTTP.

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Start the dev server
npm run dev

# 3. Test your tools
npm run test

# 4. List tools via curl
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Project Structure

```
src/
  lib/             Core framework (types, validation, MCP handler)
  tools/           Your tool definitions go here
  adapters/        Deployment adapters (Netlify, Vercel)
scripts/           Dev server, test harness, config tools
mcpx.config.json   Platform configuration
```

## Creating a New Tool

1. Copy `src/tools/_template.ts` to a new file (e.g. `src/tools/weather.ts`)
2. Define your tool using the `ToolDefinition` interface
3. Register it in `src/lib/tool-registry.ts`
4. Test with `npm run dev` and `npm run test`

See `PROMPT.md` for the complete build guide (also useful as an AI prompt).

## Pricing (USDsui)

Every tool is priced in `priceAtomic` — a string integer in USDsui's smallest
unit (6 decimals), so `"1000"` = $0.001. There are no credits. Set
`freeTierCallsPerUser` to give each caller N free calls before settlement starts.

| `priceAtomic` | USD | Use Case |
|------|------|----------|
| `"1000"`   | $0.001 | Simple read-only operations |
| `"5000"`   | $0.005 | External API calls |
| `"50000"`  | $0.05  | AI models or heavy compute |

The full schema reference (every field, the bigint convention, an annotated
example) lives in the docs: `apps/docs/content/mcpx-config-schema.md`.

## Publishing

This template uses the `@mcpxgg/server` SDK and publishes on-chain with the CLI:

```bash
# Validate mcpx.config.json against the platform schema
npx mcpxgg validate

# Dry-run the publish (prints the Walrus uploads + the publish_server PTB)
npx mcpxgg publish

# Sign + submit (needs a funded Sui key; see the CLI help)
npx mcpxgg publish --private-key "$MCPXGG_PUBLISH_KEY"
```

`mcpxgg publish` validates the config, checks namespace uniqueness on-chain,
probes your `/health` endpoint, uploads the README + tool schemas to Walrus,
then builds the `mcpx::registry::publish_server` transaction for you to sign.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Express dev server on port 3000 |
| `npm run test` | Run the automated test harness |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run generate-config` | Regenerate `mcpx.config.json` from tools |
| `npm run validate` | Validate config via `npx mcpxgg validate` |
| `npm run publish` | Publish on-chain via `npx mcpxgg publish` |

## Deploying

### Netlify

```bash
npm run build
netlify deploy --prod
```

Configuration is in `netlify.toml`.

### Vercel

```bash
vercel --prod
```

Configuration is in `vercel.json`.

## Publishing on MCPX

1. Deploy your server to a public URL
2. Run `npm run validate` to check your config
3. Go to https://mcpx.gg/developer
4. Upload your `mcpx.config.json`
5. Submit for review

## Environment Variables

Copy `.env.example` to `.env` and add your API keys:

```bash
cp .env.example .env
```

Set the same variables in your hosting platform for production.

## License

MIT
