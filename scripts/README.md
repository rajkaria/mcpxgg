# Operational Scripts

| Script | Sprint | Purpose |
|---|---|---|
| `deploy-testnet.sh` | S1 | Deploy Move package to testnet, init shared objects |
| `deploy-mainnet.sh` | S5 | Multisig-gated mainnet deploy |
| `fund-test-account.sh` | S1 | Get USDsui from testnet faucet |
| `seed-bundles.ts` | S5 | Build/print the 3 curated bundle `bundle::create` PTBs (dry-run; on-chain submit gated on S5-T22 mainnet deploy) |
| `migrate-web2-users.ts` | S8 | Web2 → Sui migration (legacy `credit_balance` → bootstrap Session) |
| `sprints-to-csv.js` | (optional) | Export `docs/SPRINTS.md` task tables to CSV for spreadsheet ingestion |
