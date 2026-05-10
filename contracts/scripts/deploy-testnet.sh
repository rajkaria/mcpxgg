#!/usr/bin/env bash
# Deploy the mcpx Move package to Sui testnet and bootstrap shared objects.
#
# Steps:
#   1. sui move build (clean)
#   2. sui client publish → captures package id
#   3. Initialize per-coin shared objects (PlatformTreasury<USDsui>, InsurancePool<USDsui>)
#      Requires the AdminCap minted at package init.
#   4. Print all object IDs in a copy-pasteable .env block.
#
# Usage:
#   ./scripts/deploy-testnet.sh [--coin-type 0xabc::usdsui::USDSUI]
#
# Prerequisites:
#   - sui CLI ≥ 1.71 (brew install sui)
#   - sui client active env = testnet (sui client switch --env testnet)
#   - sui client gas-balance > 0.5 SUI
#
# Outputs to stdout. Pipe to scripts/append-deploy-env.sh to update .env.local.

set -euo pipefail

CONTRACTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$CONTRACTS_DIR"

COIN_TYPE="${USDSUI_COIN_TYPE:-0x2::sui::SUI}"
GAS_BUDGET="${SUI_GAS_BUDGET:-200000000}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --coin-type) COIN_TYPE="$2"; shift 2;;
    --gas-budget) GAS_BUDGET="$2"; shift 2;;
    *) echo "Unknown flag: $1" >&2; exit 1;;
  esac
done

echo "==> Building Move package"
sui move build

echo "==> Publishing to testnet (gas budget: $GAS_BUDGET)"
PUBLISH_JSON=$(sui client publish --gas-budget "$GAS_BUDGET" --json)
echo "$PUBLISH_JSON" > "$CONTRACTS_DIR/build/last-publish.json"

PACKAGE_ID=$(echo "$PUBLISH_JSON" \
  | jq -r '.objectChanges[] | select(.type == "published") | .packageId')

if [[ -z "$PACKAGE_ID" || "$PACKAGE_ID" == "null" ]]; then
  echo "Error: failed to extract packageId from publish output" >&2
  exit 1
fi

REGISTRY_ID=$(echo "$PUBLISH_JSON" \
  | jq -r --arg pkg "$PACKAGE_ID" '.objectChanges[] | select(.type=="created" and (.objectType | endswith("::registry::NamespaceRegistry"))) | .objectId')

CONFIG_ID=$(echo "$PUBLISH_JSON" \
  | jq -r --arg pkg "$PACKAGE_ID" '.objectChanges[] | select(.type=="created" and (.objectType | endswith("::admin::PlatformConfig"))) | .objectId')

ADMIN_CAP_ID=$(echo "$PUBLISH_JSON" \
  | jq -r --arg pkg "$PACKAGE_ID" '.objectChanges[] | select(.type=="created" and (.objectType | endswith("::admin::AdminCap"))) | .objectId')

echo "==> Package published"
echo "    package_id      = $PACKAGE_ID"
echo "    registry_id     = $REGISTRY_ID"
echo "    config_id       = $CONFIG_ID"
echo "    admin_cap_id    = $ADMIN_CAP_ID"

echo "==> Initializing PlatformTreasury<$COIN_TYPE>"
TREASURY_JSON=$(sui client call --json --gas-budget "$GAS_BUDGET" \
  --package "$PACKAGE_ID" --module treasury --function initialize \
  --type-args "$COIN_TYPE" \
  --args "$ADMIN_CAP_ID")
TREASURY_ID=$(echo "$TREASURY_JSON" \
  | jq -r '.objectChanges[] | select(.type=="created" and (.objectType | contains("::treasury::PlatformTreasury<"))) | .objectId')

echo "==> Initializing InsurancePool<$COIN_TYPE>"
INSURANCE_JSON=$(sui client call --json --gas-budget "$GAS_BUDGET" \
  --package "$PACKAGE_ID" --module insurance --function initialize \
  --type-args "$COIN_TYPE" \
  --args "$ADMIN_CAP_ID")
INSURANCE_ID=$(echo "$INSURANCE_JSON" \
  | jq -r '.objectChanges[] | select(.type=="created" and (.objectType | contains("::insurance::InsurancePool<"))) | .objectId')

echo
echo "==================================================================="
echo "Deployment complete — paste these into .env.local:"
echo "==================================================================="
cat <<ENV
SUI_PACKAGE_ID=$PACKAGE_ID
SUI_REGISTRY_OBJECT_ID=$REGISTRY_ID
SUI_PLATFORM_CONFIG_OBJECT_ID=$CONFIG_ID
SUI_ADMIN_CAP_ID=$ADMIN_CAP_ID
SUI_TREASURY_OBJECT_ID=$TREASURY_ID
SUI_INSURANCE_VAULT_OBJECT_ID=$INSURANCE_ID
USDSUI_COIN_TYPE=$COIN_TYPE
ENV
echo "==================================================================="
