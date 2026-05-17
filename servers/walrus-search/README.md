# walrus-search

Anchor MCP server #1 (Sprint 3). Semantic search over documents, with the
indexed corpus durably archived to Walrus.

Built on `@mcpxgg/server`. Every paid call settles in USDsui through the
mcpxgg gateway → x402 facilitator and returns a verifiable on-chain receipt.

## Tools

| Tool | Price (USDsui atomic) | Free tier | Description |
|---|---|---|---|
| `index` | 10000 | 0 | Embed + index documents; archives the corpus to Walrus and returns the blob id. |
| `query` | 5000 | 3 / user | Semantic search; returns the topK most similar documents with scores. |
| `delete_index` | 0 | 0 | Delete an index and all of its vectors. |

## Architecture

- **Embeddings** (`src/embeddings.ts`): dependency-free deterministic local
  embedder by default (hermetic CI); set `OPENAI_API_KEY` to upgrade to
  `text-embedding-3-small`. The `Embedder` interface is the only contract.
- **Vector store** (`src/vector-store.ts`): in-memory cosine store by
  default; Qdrant/Pinecone implement the same `VectorStore` interface for
  production scale.
- **Durability**: each `index` call uploads the full corpus snapshot to
  Walrus; the blob id is returned and echoed by `query` as `corpus_blob_id`.

## Run locally

```bash
pnpm --filter @mcpxgg/walrus-search dev   # listens on :3010
```

## Test

```bash
pnpm --filter @mcpxgg/walrus-search test
```
