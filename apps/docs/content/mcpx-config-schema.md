# `mcpx.config.json` reference

Every MCP server published on [mcpx.gg](https://mcpx.gg) is described by a
single `mcpx.config.json` at the root of the server's directory. The
`@mcpxgg/cli` reads this file for `validate` and `publish`, and the on-chain
`mcpx::registry` module is the canonical store of the values it contains.

> The schema is enforced by `@mcpxgg/shared` → `validation/config-schema.ts`.
> `npx mcpxgg validate` runs exactly that validator — if it passes locally it
> will pass on publish.

Generate a starter file with `npx mcpxgg init`.

---

## Top-level fields

| Field            | Type       | Rules                                                                                       |
| ---------------- | ---------- | ------------------------------------------------------------------------------------------- |
| `namespace`      | `string`   | 3–64 chars, `^[a-z0-9_-]+$`, cannot start/end with `-`. **Globally unique per chain.**      |
| `name`           | `string`   | 3–50 chars. Human-facing display name.                                                      |
| `description`    | `string`   | 10–200 chars.                                                                               |
| `category`       | `string`   | One of: `intelligence`, `analytics`, `productivity`, `devtools`, `data`, `communication`, `marketing`, `other`. |
| `tags`           | `string[]` | 1–10 entries, each lowercase.                                                               |
| `triggerPhrases` | `string[]` | 1–20 entries. Natural-language phrases that hint when to use this server.                   |
| `endpointUrl`    | `string`   | Public HTTPS base URL of the running server. `publish` probes `${endpointUrl}/health` (2xx required) unless `--skip-health`. |
| `tools`          | `Tool[]`   | 1–100 entries (matches contracts `MAX_TOOLS_PER_SERVER`).                                   |

The `namespace` uniqueness is checked on `publish` via a read-only Sui RPC
call into `mcpx::registry::namespace_taken`. Publishing a taken namespace
aborts on-chain with `E_NAMESPACE_TAKEN`.

## `Tool` object

| Field                  | Type                | Rules                                                                              |
| ---------------------- | ------------------- | ---------------------------------------------------------------------------------- |
| `name`                 | `string`            | Non-empty, ≤ 64 chars. Unique within the server.                                   |
| `description`          | `string`            | Non-empty.                                                                         |
| `priceAtomic`          | `string` \| `number`| Per-call price in **USDsui atomic units**. See below.                              |
| `freeTierCallsPerUser` | `number`            | Non-negative integer. Calls a given user gets free before billing. `0` = no free tier. |
| `timeoutSeconds`       | `number`            | Integer 1–600.                                                                     |
| `inputSchema`          | `object`            | JSON Schema for the tool's arguments. Uploaded to Walrus on publish.               |

### `priceAtomic` — the bigint convention

Pricing is **never** credit-cost integers (`1 | 3 | 10`). It is an absolute
amount in **USDsui smallest units**, which has **6 decimals**:

```
1 USDsui            = 1_000_000 atomic
$0.05               =    50_000 atomic
$0.005              =     5_000 atomic
free                =         0 atomic
```

Wire format: because JSON numbers lose precision past 2^53, `priceAtomic`
**should be a decimal string** (a plain `number` is accepted only for values
≤ 9,007,199,254,740,991). SDKs writing this file must string-encode.

Bounds:

- Minimum: `0` (a genuinely free tool).
- Schema maximum: u64 max, `(1 << 63) - 1`.
- The CLI additionally rejects anything above **`1_000_000_000_000` atomic
  (1,000,000 USDsui per call)** as an obvious misconfiguration guard
  (`MAX_TOOL_PRICE_ATOMIC` in `@mcpxgg/cli`).

Note: the on-chain `registry::add_tool` requires `price_atomic > 0`, so a
`0`-priced tool is registered as metadata only and is always free at the
gateway — it is never settled.

### `freeTierCallsPerUser`

The number of successful calls each distinct payer may make to this tool
before the gateway begins settling `priceAtomic` per call. It is per-user,
not global. `0` disables the free tier entirely (every call is billed).

## Annotated example

```jsonc
{
  // 3–64 chars, unique on-chain. Lowercase, digits, - and _ only.
  "namespace": "walrus-search",
  "name": "Walrus Search",
  "description": "Semantic search over documents, durably archived to Walrus.",
  "category": "intelligence",
  "tags": ["search", "embeddings", "walrus", "rag"],
  "triggerPhrases": ["search my docs", "semantic search"],
  // publish probes https://walrus-search.mcpx.gg/health (must be 2xx)
  "endpointUrl": "https://walrus-search.mcpx.gg",
  "tools": [
    {
      "name": "index",
      "description": "Embed and index documents.",
      "priceAtomic": "10000",        // $0.01 per call (10_000 / 1_000_000)
      "freeTierCallsPerUser": 0,     // billed from the first call
      "timeoutSeconds": 60,
      "inputSchema": {
        "type": "object",
        "properties": { "indexName": { "type": "string" } },
        "required": ["indexName"]
      }
    },
    {
      "name": "query",
      "description": "Semantic search; returns top-K matches.",
      "priceAtomic": "5000",         // $0.005 per call
      "freeTierCallsPerUser": 3,     // first 3 calls per user are free
      "timeoutSeconds": 30,
      "inputSchema": {
        "type": "object",
        "properties": { "query": { "type": "string" } },
        "required": ["query"]
      }
    },
    {
      "name": "delete_index",
      "description": "Delete an index and all of its vectors.",
      "priceAtomic": "0",            // free (metadata only — never settled)
      "freeTierCallsPerUser": 0,
      "timeoutSeconds": 30,
      "inputSchema": {
        "type": "object",
        "properties": { "indexName": { "type": "string" } },
        "required": ["indexName"]
      }
    }
  ]
}
```

## Publish lifecycle

`npx mcpxgg publish` performs, in order:

1. Load + schema-validate `mcpx.config.json`.
2. Price-range validation (`MAX_TOOL_PRICE_ATOMIC`).
3. Namespace uniqueness check via Sui RPC.
4. `GET ${endpointUrl}/health` — require 2xx (skip with `--skip-health`).
5. Upload `README.md` (if present) + each tool's `inputSchema` + a server
   metadata blob to Walrus; collect blob ids.
6. Assemble the `mcpx::registry::publish_server` PTB.

The CLI holds no keys. By default `publish` is a **dry run** — it prints the
assembled (unsigned) base64 transaction and the Walrus blob ids. To submit,
pass `--no-dry-run` with `--private-key`/`MCPXGG_PUBLISH_KEY`, or sign the
printed transaction bytes with your own Sui wallet.
