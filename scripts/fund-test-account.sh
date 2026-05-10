#!/usr/bin/env bash
# Fund a Sui address with testnet SUI from the public faucet.
# Usage:
#   ./scripts/fund-test-account.sh                # fund the active sui client address
#   ./scripts/fund-test-account.sh 0xabc...       # fund a specific address
#
# The faucet returns 1 SUI (10^9 MIST). USDsui isn't on testnet faucet yet —
# follow the docs site for testnet USDsui mint instructions.

set -euo pipefail

ADDRESS="${1:-}"

if [[ -z "$ADDRESS" ]]; then
  ADDRESS=$(sui client active-address 2>/dev/null || true)
  if [[ -z "$ADDRESS" ]]; then
    echo "No active Sui address. Pass one as the first argument or run 'sui client'." >&2
    exit 1
  fi
fi

echo "==> Requesting testnet SUI for $ADDRESS"
RESPONSE=$(curl -fsS -X POST https://faucet.testnet.sui.io/v2/gas \
  -H 'Content-Type: application/json' \
  -d "{\"FixedAmountRequest\":{\"recipient\":\"$ADDRESS\"}}")

echo "$RESPONSE"

echo
echo "==> Checking gas balance"
sui client gas
