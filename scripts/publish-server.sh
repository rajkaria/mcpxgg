#!/usr/bin/env bash
# S3-T15: publish a first-party MCP server to the on-chain registry using the
# raw `sui client` (the `npx mcpxgg publish` CLI lands in Sprint 5, S5-T07+).
#
# What it does deterministically (no keystore needed):
#   1. Validate the server's mcpx.config.json
#   2. Upload README.md + each tool's inputSchema to Walrus → blob ids
#   3. Print the exact `sui client call mcpx::registry::publish_server` command
#
# Executing the on-chain call needs the testnet package id (S1-T17 deploy) and
# a funded keystore — intentionally a separate, gated step.
#
# Usage:
#   ./scripts/publish-server.sh servers/walrus-search
#
# Env:
#   WALRUS_PUBLISHER_URL   default https://publisher.walrus-testnet.walrus.space
#   MCPX_PACKAGE_ID        required only to emit the final call command
#   MCPX_REGISTRY_ID       required only to emit the final call command

set -euo pipefail

SERVER_DIR="${1:?usage: publish-server.sh <server-dir>}"
CONFIG="$SERVER_DIR/mcpx.config.json"
WALRUS_PUBLISHER_URL="${WALRUS_PUBLISHER_URL:-https://publisher.walrus-testnet.walrus.space}"

command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
[[ -f "$CONFIG" ]] || { echo "missing $CONFIG" >&2; exit 1; }

NAMESPACE=$(jq -r '.namespace' "$CONFIG")
ENDPOINT=$(jq -r '.endpointUrl' "$CONFIG")
CATEGORY=$(jq -r '.category' "$CONFIG")
echo "==> Publishing '$NAMESPACE' ($CATEGORY) → $ENDPOINT"

walrus_put() {
  # $1 = file path → echoes blobId
  curl -sf -X PUT "$WALRUS_PUBLISHER_URL/v1/blobs?epochs=200" \
    --data-binary "@$1" \
    | jq -r '.newlyCreated.blobObject.blobId // .alreadyCertified.blobId'
}

README="$SERVER_DIR/README.md"
if [[ -f "$README" ]]; then
  META_BLOB=$(walrus_put "$README")
else
  TMP=$(mktemp); jq -r '.description' "$CONFIG" > "$TMP"; META_BLOB=$(walrus_put "$TMP"); rm -f "$TMP"
fi
echo "    metadata blob: $META_BLOB"

TOOL_ARGS=$(jq -c '.tools' "$CONFIG")
echo "    tools: $(echo "$TOOL_ARGS" | jq 'length')"
while read -r tool; do
  TNAME=$(echo "$tool" | jq -r '.name')
  TMP=$(mktemp); echo "$tool" | jq '.inputSchema' > "$TMP"
  SCHEMA_BLOB=$(walrus_put "$TMP"); rm -f "$TMP"
  echo "    tool '$TNAME' schema blob: $SCHEMA_BLOB"
done < <(echo "$TOOL_ARGS" | jq -c '.[]')

if [[ -n "${MCPX_PACKAGE_ID:-}" && -n "${MCPX_REGISTRY_ID:-}" ]]; then
  cat <<EOF

==> Run this to publish on-chain (needs a funded keystore):
sui client call \\
  --package $MCPX_PACKAGE_ID --module registry --function publish_server \\
  --args $MCPX_REGISTRY_ID "$NAMESPACE" "$ENDPOINT" "$META_BLOB" "$CATEGORY" \\
  --gas-budget 100000000
EOF
else
  echo
  echo "==> Set MCPX_PACKAGE_ID + MCPX_REGISTRY_ID (after S1-T17 testnet deploy) to emit the publish call."
fi
