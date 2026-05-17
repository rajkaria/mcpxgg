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
  signAndExecuteBase64Tx,
  addressFromPrivateKey,
  getActiveChain,
} from '@mcpxgg/chain';
import type { AttestInput, QualityChainClient } from './oracle.js';

export interface ChainClientConfig {
  packageId: string;
  rpcUrl: string;
  oracleCapId: string;
  oraclePrivateKey: string;
}

export async function createChainClient(cfg: ChainClientConfig): Promise<QualityChainClient> {
  // Touch the active chain so adding Base/Solana later is purely additive and
  // we never hard-code a chain id here (operating principle).
  getActiveChain();
  const sender = await addressFromPrivateKey(cfg.oraclePrivateKey);

  return {
    async attest(input: AttestInput): Promise<{ digest: string }> {
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
      return { digest: res.digest };
    },
  };
}
