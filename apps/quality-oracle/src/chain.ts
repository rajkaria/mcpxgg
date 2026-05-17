/**
 * Production QualityChainClient. Builds the attest PTB via @mcpxgg/chain
 * (`buildAttestQualityTx`) and signs+submits it through the chain package's
 * `signAndExecuteBase64Tx`. The oracle never imports @mysten/sui directly
 * and never hand-rolls a tx — everything goes through ChainAdapter/chain.
 *
 * The package id / RPC come from the active chain registry where possible;
 * `getActiveChain()` enforces "no hard-coded chain ids". The Move package id
 * + OracleCap are deployment facts passed via env.
 */

import {
  buildAttestQualityTx,
  buildSlashStakeTx,
  signAndExecuteBase64Tx,
  addressFromPrivateKey,
  getActiveChain,
} from '@mcpxgg/chain';
import type {
  AttestInput,
  QualityChainClient,
  SlashChainClient,
  SlashInput,
} from './oracle.js';

export interface ChainClientConfig {
  packageId: string;
  rpcUrl: string;
  oracleCapId: string;
  oraclePrivateKey: string;
}

export interface SlashChainConfig extends ChainClientConfig {
  /** USDsui coin type tag — the `slash<T>` type argument. */
  coinType: string;
  /** Shared InsurancePool object id slashed funds route to. */
  insurancePoolId: string;
}

export async function createChainClient(cfg: ChainClientConfig): Promise<QualityChainClient> {
  // Touch the active chain so adding Base/Solana later is purely additive and
  // we never hard-code a chain id here (operating principle).
  getActiveChain();
  const sender = await addressFromPrivateKey(cfg.oraclePrivateKey);

  return {
    async attest(
      input: AttestInput,
    ): Promise<{ digest: string; attestationObjectId: string | null }> {
      const built = await buildAttestQualityTx({
        cfg: { packageId: cfg.packageId, rpcUrl: cfg.rpcUrl },
        sender,
        oracleCapId: cfg.oracleCapId,
        serverObjectId: input.serverObjectId,
        scoreX100: input.scoreX100,
        uptimeX100: input.uptimeX100,
        p95LatencyMs: input.p95LatencyMs,
        errorRateX100: input.errorRateX100,
        sampleCount: input.sampleCount,
        windowStartMs: input.windowStartMs,
        windowEndMs: input.windowEndMs,
      });
      const res = await signAndExecuteBase64Tx({
        txBytesB64: built.txBytesB64,
        privateKey: cfg.oraclePrivateKey,
        rpcUrl: cfg.rpcUrl,
      });
      // `mcpx::quality::attest` shares a `QualityAttestation`; its created
      // object's type ends in `::quality::QualityAttestation`. The slash pass
      // needs this id to prove the breach on-chain (security hardening).
      const att = res.created.find((c) =>
        c.objectType.endsWith('::quality::QualityAttestation'),
      );
      return {
        digest: res.digest,
        attestationObjectId: att ? att.objectId : null,
      };
    },
  };
}

/**
 * Production SlashChainClient (S7-T09). Builds the `mcpx::staking::slash` PTB
 * via @mcpxgg/chain `buildSlashStakeTx` and signs+submits it through
 * `signAndExecuteBase64Tx` with the oracle's key — the *exact* signer/cap path
 * `createChainClient`/attest uses. The OracleCap is an owned object held by
 * the oracle address; slashed USDsui routes on-chain to the InsurancePool.
 */
export async function createSlashChainClient(
  cfg: SlashChainConfig,
): Promise<SlashChainClient> {
  getActiveChain();
  const sender = await addressFromPrivateKey(cfg.oraclePrivateKey);

  return {
    async slash(input: SlashInput): Promise<{ digest: string }> {
      const built = await buildSlashStakeTx({
        cfg: {
          packageId: cfg.packageId,
          rpcUrl: cfg.rpcUrl,
          coinType: cfg.coinType,
          // sessionRegistryId is unused by slash; satisfy the type.
          sessionRegistryId: '0x0',
        },
        sender,
        oracleCapId: cfg.oracleCapId,
        stakeObjectId: input.stakeObjectId,
        insurancePoolId: cfg.insurancePoolId,
        attestationObjectId: input.attestationObjectId,
        amountAtomic: input.amountAtomic,
        reason: input.reason,
      });
      const res = await signAndExecuteBase64Tx({
        txBytesB64: built.txBytesB64,
        privateKey: cfg.oraclePrivateKey,
        rpcUrl: cfg.rpcUrl,
      });
      return { digest: res.digest };
    },
  };
}
