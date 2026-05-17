#!/usr/bin/env bash
# S4-T16: inspect / "refill" the bootstrap-subsidy budget.
#
# The monthly cap lives in the facilitator's SubsidyLedger (env
# SUBSIDY_MONTHLY_BUDGET_ATOMIC) and the on-chain PlatformConfig.subsidy_atomic
# (admin-multisig gated, ADR-001). This script reads the live snapshot and
# prints the admin call needed to raise the on-chain cap.
#
# Usage:
#   FACILITATOR_URL=https://facilitator.mcpx.gg ./scripts/refill-subsidy.sh
#   MCPX_PACKAGE_ID=0x.. MCPX_PLATFORM_CONFIG_ID=0x.. NEW_SUBSIDY_ATOMIC=2000000 \
#     ./scripts/refill-subsidy.sh

set -euo pipefail
FACILITATOR_URL="${FACILITATOR_URL:-http://localhost:3002}"

echo "==> Current subsidy snapshot"
curl -sf "$FACILITATOR_URL/admin/subsidy" | (command -v jq >/dev/null && jq . || cat)

if [[ -n "${MCPX_PACKAGE_ID:-}" && -n "${MCPX_PLATFORM_CONFIG_ID:-}" && -n "${NEW_SUBSIDY_ATOMIC:-}" ]]; then
  cat <<EOF

==> Raise the on-chain subsidy (admin multisig signs):
sui client call \\
  --package $MCPX_PACKAGE_ID --module admin --function set_subsidy_atomic \\
  --args $MCPX_PLATFORM_CONFIG_ID $NEW_SUBSIDY_ATOMIC \\
  --gas-budget 100000000
EOF
else
  echo
  echo "==> Set MCPX_PACKAGE_ID + MCPX_PLATFORM_CONFIG_ID + NEW_SUBSIDY_ATOMIC to emit the on-chain call."
fi
