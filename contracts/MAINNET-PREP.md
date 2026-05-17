# Mainnet Deploy Prep (S5-T21)

The pre-flight checklist and rehearsal procedure that **must** be green before
`scripts/deploy-mainnet.sh --submit` is run. Mainnet is the June 21 hard gate
(ADR-001: package upgrade-capped behind multisig once mainnet).

## 1. Code audit gate

- [ ] `bash contracts/scripts/run-move-tests.sh` — all Move tests pass.
- [ ] Move coverage report attached (target ≥ 80% branch on core modules:
      registry, session, settlement, vault, treasury, insurance, admin).
- [ ] `sui move build` clean with the **mainnet** framework rev (flip
      `Move.toml` `[dependencies] Sui rev` from `framework/testnet` →
      `framework/mainnet`; this is the only Move.toml change for mainnet).
- [ ] Diff of `contracts/sources/*` since last audit reviewed; no `public`
      function added without a test.
- [ ] Audit submission package prepared (S8-T03): cleaned source + threat
      model + coverage report → OtterSec / OpenZeppelin (hackathon credits).
      Mainnet deploy may precede audit sign-off for the hackathon, but the
      package is upgrade-capped behind multisig so a post-audit patch path
      exists.

## 2. Multisig (ADR-001) gate

- [ ] AdminCap multisig stood up (Sui multisig: ≥ 2-of-3 recommended).
      Record the multisig address.
- [ ] Signers identified and each has tested signing on testnet.
- [ ] `deploy-mainnet.sh` will transfer `AdminCap` to the multisig in the
      same run — confirm `--admin-multisig <addr>` is the multisig, not a
      hot key. Verify post-deploy that `AdminCap` owner == multisig.

## 3. Economic config gate

- [ ] Mainnet stable coin type confirmed (`USDSUI_COIN_TYPE`). Document it
      in `DEPLOY.md`. Do **not** ship with `0x2::sui::SUI` as the settlement
      coin — that is a testnet placeholder.
- [ ] `PlatformConfig` defaults reviewed: 250 bps take rate
      (50 bps insurance + 200 bps treasury) per the locked decision.
- [ ] Subsidy budget cap in `PlatformConfig` set to a real monthly figure.

## 4. Testnet rehearsal (mandatory before --submit)

This is exactly the mainnet sequence, run on testnet, end to end:

1. `bash contracts/scripts/deploy-testnet.sh` → capture object IDs.
2. Publish an anchor server via `npx mcpxgg publish` (CLI, S5-T07..T11)
   against the testnet package.
3. Create a Session + deposit (web `<RechargeFlow/>` or raw PTB).
4. Settle one call through the facilitator; confirm `CallReceipt` minted
   and the indexer mirrored it (`dashboard_usage` row with `tx_digest`).
5. Activate a bundle (`buildActivateBundleTx`) and confirm the
   `BundleActivated` event mirrored to `bundles` (migration 009).
6. Exercise the AdminCap multisig once on testnet (e.g. a no-op
   `PlatformConfig` update) to prove the signer set works.

Only after all six pass may `--i-have-rehearsed-on-testnet` be asserted.

## 5. Dry run, then submit

```bash
sui client switch --env mainnet
# Rehearsal print — submits nothing:
bash contracts/scripts/deploy-mainnet.sh --dry-run \
  --admin-multisig 0x<multisig> --coin-type 0x<stable>::usdc::USDC

# Real deploy (only after sections 1–4 are all checked):
bash contracts/scripts/deploy-mainnet.sh --submit \
  --i-have-rehearsed-on-testnet \
  --admin-multisig 0x<multisig> --coin-type 0x<stable>::usdc::USDC
```

## 6. Post-deploy (S5-T23..T25)

- [ ] Lock printed object IDs into `contracts/DEPLOY.md` + prod `.env`.
- [ ] Re-publish anchor servers (walrus-search, sui-defi-data,
      sui-analytics) to mainnet (S5-T23).
- [ ] Point prod `apps/web`, `apps/gateway`, `apps/facilitator`,
      `apps/indexer` env at mainnet IDs (S5-T24).
- [ ] Post-mainnet smoke: one end-to-end call from Cursor, receipt
      verifiable on suiscan (S5-T25).

> **Blocked-on-Raj:** sections 2 (multisig signers), 3 (mainnet coin type),
> and the keystore/funds for section 5 are credential-gated. See
> `docs/BLOCKED.md` item 11.
