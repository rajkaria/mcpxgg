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

## Credit Costs

| Cost | Use Case |
|------|----------|
| 1    | Simple read-only operations |
| 3    | External API calls |
| 10   | AI models or heavy compute |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Express dev server on port 3000 |
| `npm run test` | Run the automated test harness |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run generate-config` | Regenerate `mcpx.config.json` from tools |
| `npm run validate` | Validate config against MCPX schema |

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
