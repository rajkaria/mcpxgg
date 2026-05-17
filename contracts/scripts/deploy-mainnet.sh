#!/usr/bin/env bash
# Deploy the mcpx Move package to Sui MAINNET and bootstrap shared objects.
#
# This is the S5-T22 hard gate. It is deliberately conservative:
#   - refuses to run unless `sui client active-env` is `mainnet`
#   - refuses to run unless --i-have-rehearsed-on-testnet is passed
#   - defaults to --dry-run (prints the publish + init plan, submits nothing)
#   - on real publish, transfers AdminCap to the multisig address (ADR-001),
#     never leaving it in the deployer's hot key
#
# Usage:
#   ./scripts/deploy-mainnet.sh --dry-run                       # rehearsal
#   ./scripts/deploy-mainnet.sh --i-have-rehearsed-on-testnet \
#       --admin-multisig 0x<multisig> --coin-type 0x<usdc>::usdc::USDC --submit
#
# Prerequisites (see contracts/MAINNET-PREP.md for the full checklist):
#   - testnet rehearsal completed and verified
#   - sui CLI ≥ 1.71, active env = mainnet, gas-balance > 2 SUI
#   - AdminCap multisig stood up; its address passed via --admin-multisig
#   - USDsui (or chosen stable) coin type confirmed on mainnet

set -euo pipefail

CONTRACTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$CONTRACTS_DIR"

DRY_RUN=1
REHEARSED=0
SUBMIT=0
ADMIN_MULTISIG=""
COIN_TYPE="${USDSUI_COIN_TYPE:-}"
GAS_BUDGET="${SUI_GAS_BUDGET:-500000000}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; SUBMIT=0; shift;;
    --submit) SUBMIT=1; DRY_RUN=0; shift;;
    --i-have-rehearsed-on-testnet) REHEARSED=1; shift;;
    --admin-multisig) ADMIN_MULTISIG="$2"; shift 2;;
    --coin-type) COIN_TYPE="$2"; shift 2;;
    --gas-budget) GAS_BUDGET="$2"; shift 2;;
    *) echo "Unknown flag: $1" >&2; exit 1;;
  esac
done

ACTIVE_ENV="$(sui client active-env 2>/dev/null || echo unknown)"
if [[ "$ACTIVE_ENV" != "mainnet" ]]; then
  echo "Refusing to run: sui active-env is '$ACTIVE_ENV', expected 'mainnet'." >&2
  echo "  sui client switch --env mainnet" >&2
  exit 1
fi

if [[ "$SUBMIT" -eq 1 && "$REHEARSED" -ne 1 ]]; then
  echo "Refusing to submit: pass --i-have-rehearsed-on-testnet (see MAINNET-PREP.md)." >&2
  exit 1
fi
if [[ "$SUBMIT" -eq 1 && -z "$ADMIN_MULTISIG" ]]; then
  echo "Refusing to submit: --admin-multisig <addr> is required (ADR-001)." >&2
  exit 1
fi
if [[ -z "$COIN_TYPE" ]]; then
  echo "Refusing to run: --coin-type / USDSUI_COIN_TYPE must be set (mainnet stable coin type)." >&2
  exit 1
fi

echo "==> Building Move package (mainnet rev)"
sui move build

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo
  echo "DRY RUN — nothing was submitted. Plan:"
  echo "  1. sui client publish --gas-budget $GAS_BUDGET"
  echo "  2. treasury::initialize  <AdminCap> [type: $COIN_TYPE]"
  echo "  3. insurance::initialize <AdminCap> [type: $COIN_TYPE]"
  echo "  4. transfer AdminCap → $ADMIN_MULTISIG (multisig custody, ADR-001)"
  echo "  5. lock printed IDs into contracts/DEPLOY.md + prod env"
  echo
  echo "Re-run with --submit --i-have-rehearsed-on-testnet --admin-multisig <addr> to execute."
  exit 0
fi

echo "==> Publishing to MAINNET (gas budget: $GAS_BUDGET)"
PUBLISH_JSON=$(sui client publish --gas-budget "$GAS_BUDGET" --json)
mkdir -p "$CONTRACTS_DIR/build"
echo "$PUBLISH_JSON" > "$CONTRACTS_DIR/build/last-mainnet-publish.json"

PACKAGE_ID=$(echo "$PUBLISH_JSON" | jq -r '.objectChanges[] | select(.type=="published") | .packageId')
[[ -n "$PACKAGE_ID" && "$PACKAGE_ID" != "null" ]] || { echo "Error: no packageId" >&2; exit 1; }

REGISTRY_ID=$(echo "$PUBLISH_JSON" | jq -r '.objectChanges[] | select(.type=="created" and (.objectType|endswith("::registry::NamespaceRegistry"))) | .objectId')
CONFIG_ID=$(echo "$PUBLISH_JSON" | jq -r '.objectChanges[] | select(.type=="created" and (.objectType|endswith("::admin::PlatformConfig"))) | .objectId')
ADMIN_CAP_ID=$(echo "$PUBLISH_JSON" | jq -r '.objectChanges[] | select(.type=="created" and (.objectType|endswith("::admin::AdminCap"))) | .objectId')

echo "==> Initializing PlatformTreasury<$COIN_TYPE>"
TREASURY_JSON=$(sui client call --json --gas-budget "$GAS_BUDGET" \
  --package "$PACKAGE_ID" --module treasury --function initialize \
  --type-args "$COIN_TYPE" --args "$ADMIN_CAP_ID")
TREASURY_ID=$(echo "$TREASURY_JSON" | jq -r '.objectChanges[] | select(.type=="created" and (.objectType|contains("::treasury::PlatformTreasury<"))) | .objectId')

echo "==> Initializing InsurancePool<$COIN_TYPE>"
INSURANCE_JSON=$(sui client call --json --gas-budget "$GAS_BUDGET" \
  --package "$PACKAGE_ID" --module insurance --function initialize \
  --type-args "$COIN_TYPE" --args "$ADMIN_CAP_ID")
INSURANCE_ID=$(echo "$INSURANCE_JSON" | jq -r '.objectChanges[] | select(.type=="created" and (.objectType|contains("::insurance::InsurancePool<"))) | .objectId')

echo "==> Transferring AdminCap to multisig $ADMIN_MULTISIG (ADR-001)"
sui client transfer --json --gas-budget "$GAS_BUDGET" \
  --object-id "$ADMIN_CAP_ID" --to "$ADMIN_MULTISIG" >/dev/null

echo
echo "==================================================================="
echo "MAINNET deployment complete — lock these into contracts/DEPLOY.md + prod env:"
echo "==================================================================="
cat <<ENV
SUI_NETWORK=mainnet
SUI_PACKAGE_ID=$PACKAGE_ID
SUI_REGISTRY_OBJECT_ID=$REGISTRY_ID
SUI_PLATFORM_CONFIG_OBJECT_ID=$CONFIG_ID
SUI_ADMIN_CAP_ID=$ADMIN_CAP_ID   # now held by multisig $ADMIN_MULTISIG
SUI_TREASURY_OBJECT_ID=$TREASURY_ID
SUI_INSURANCE_VAULT_OBJECT_ID=$INSURANCE_ID
USDSUI_COIN_TYPE=$COIN_TYPE
ENV
echo "==================================================================="
echo "Next: re-publish anchor servers (S5-T23), point prod env at mainnet"
echo "(S5-T24), run the post-deploy smoke (S5-T25)."
