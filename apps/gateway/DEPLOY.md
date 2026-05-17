# Gateway + walrus-search — deploy & end-to-end demo runbook

Covers S3-T09 (gateway → Fly.io), S3-T10 (`mcp.mcpx.gg` DNS), S3-T16
(walrus-search deploy), and S3-T17 (the Cursor end-to-end demo).

> Status: code-side complete and CI-green. The steps below need live
> credentials (Fly.io, DNS, a funded Sui keystore from S1-T17) and are the
> remaining outstanding actions for Sprint 3, mirroring how S1/S2 left their
> credentialed deploys.

## 1. Deploy the gateway (S3-T09)

```bash
fly launch --no-deploy --copy-config --name mcpxgg-gateway --dockerfile apps/gateway/Dockerfile
fly secrets set -a mcpxgg-gateway \
  FACILITATOR_URL=https://facilitator.mcpx.gg \
  USDSUI_COIN_TYPE=0x...::usdsui::USDSUI \
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... \
  WALRUS_PUBLISHER_URL=https://publisher.walrus-testnet.walrus.space \
  WALRUS_AGGREGATOR_URL=https://aggregator.walrus-testnet.walrus.space
fly deploy -a mcpxgg-gateway --dockerfile apps/gateway/Dockerfile
```

Health: `curl https://mcpxgg-gateway.fly.dev/health` → `{"status":"ok"}`.

## 2. DNS (S3-T10)

Point `mcp.mcpx.gg` at the Fly app:

```bash
fly certs add -a mcpxgg-gateway mcp.mcpx.gg
# add the AAAA/A + CNAME records fly prints to the mcpx.gg zone
```

## 3. Deploy walrus-search (S3-T16)

```bash
fly deploy -a mcpxgg-walrus-search --dockerfile servers/walrus-search/Dockerfile
# optional: fly secrets set -a mcpxgg-walrus-search OPENAI_API_KEY=sk-...
```

## 4. Publish walrus-search to the registry (S3-T15)

```bash
MCPX_PACKAGE_ID=0x...  MCPX_REGISTRY_ID=0x... \
  ./scripts/publish-server.sh servers/walrus-search
```

This uploads the README + tool schemas to Walrus and prints the
`sui client call mcpx::registry::publish_server` command. Run it with a
funded testnet keystore. The indexer (S2) then mirrors the
`ServerPublished` event into `mcp_servers`, which the gateway reads.

## 5. End-to-end demo from Cursor (S3-T17)

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mcpxgg": {
      "url": "https://mcp.mcpx.gg/",
      "headers": { "Authorization": "Bearer mcpx_sk_<your-key>" }
    }
  }
}
```

Then in Cursor:

1. Recharge a session with USDsui (web app, Sprint 4 — until then seed
   `chain_balances` via the indexer from an on-chain `createSession`).
2. Ask Cursor to index a few docs: it calls `walrus-search_index`.
3. Ask a question: it calls `walrus-search_query`.
4. The response's `_meta.receipt` contains `tx_digest`, `blob_id`,
   `amount_atomic`, and `explorer_url`. Open `explorer_url` on
   suiscan.xyz — the `CallReceipt` and settlement are verifiable on-chain.

Backward compat: `https://mcpx.gg/api/mcp` reverse-proxies to the same
gateway (S3-T11), so already-distributed configs keep working.
