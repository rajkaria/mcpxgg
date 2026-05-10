#!/usr/bin/env bash
# Run all Move unit tests with branch coverage and emit a summary.
# Used by CI; safe to run locally.

set -euo pipefail

CONTRACTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$CONTRACTS_DIR"

echo "==> sui move build"
sui move build

echo "==> sui move test --coverage"
sui move test --coverage

echo "==> sui move coverage summary"
sui move coverage summary
