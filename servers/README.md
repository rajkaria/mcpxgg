# Anchor MCP Servers

First-party MCP servers operated by mcpxgg. Each is independently deployable.

| Server | Sprint | Purpose |
|---|---|---|
| `walrus-search` | 3 | Semantic search across Walrus blobs |
| `sui-defi-data` | 5 | Aggregated liquidity, prices, pool data across Cetus, Bluefin, Scallop, Navi, DeepBook |
| `sui-analytics` | 5 | Natural-language queries over Sui state |
| `walrus-store` | 6 | Agent-native file upload/retrieval with x402 micropayments per byte |
| `sui-identity` | 6 | zkLogin-aware identity resolver (SuiNS + reputation) |

Each server uses `@mcpxgg/server` SDK and `mcpx.config.json` for marketplace registration.
