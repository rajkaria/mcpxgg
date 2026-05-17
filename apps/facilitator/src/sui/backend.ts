/**
 * SuiBackend — the only file that imports from `@mysten/sui`.
 *
 * The rest of the facilitator works against the interface; tests inject an
 * in-memory implementation. This is the same boundary discipline the
 * `packages/chain` adapter enforces app-wide.
 */

import type {
  PlatformConfigView,
  SessionView,
  SettleSubmitParams,
  SettleSubmitResult,
} from './types.js';
import { ChainError } from './types.js';
import type { FacilitatorEnv } from '../env.js';

export interface SuiBackend {
  getSession(sessionObjectId: string): Promise<SessionView | null>;
  getPlatformConfig(): Promise<PlatformConfigView>;
  verifyEd25519(signatureB64: string, publicMessage: string, payerAddress: string): Promise<boolean>;
  submitSettle(params: SettleSubmitParams): Promise<SettleSubmitResult>;
  nowMs(): number;
  todayEpochDay(): number;
}

/**
 * Real Sui backend. Lazy-loads `@mysten/sui` so test runs without the SDK
 * installed still work (e.g. type-only consumers of this interface).
 */
export async function createRealSuiBackend(env: FacilitatorEnv): Promise<SuiBackend> {
  if (env.testMode) {
    throw new Error('createRealSuiBackend called in testMode — use createInMemorySuiBackend');
  }
  // Imported dynamically so the test path doesn't require the dependency
  // graph to resolve `@mysten/sui` until prod is actually run.
  const { SuiClient } = await import('@mysten/sui/client');
  const { Transaction } = await import('@mysten/sui/transactions');
  const { Ed25519Keypair } = await import('@mysten/sui/keypairs/ed25519');
  const { fromB64 } = await import('@mysten/sui/utils');
  const { decodeSuiPrivateKey } = await import('@mysten/sui/cryptography');

  const client = new SuiClient({ url: env.suiRpcUrl });
  if (!env.gasStationKey) {
    throw new Error('GAS_STATION_KEY missing — required in non-test mode');
  }
  const { secretKey } = decodeSuiPrivateKey(env.gasStationKey);
  const gasStationKeypair = Ed25519Keypair.fromSecretKey(secretKey);

  return {
    async getSession(sessionObjectId): Promise<SessionView | null> {
      try {
        const obj = await client.getObject({
          id: sessionObjectId,
          options: { showContent: true, showOwner: true },
        });
        if (obj.error) return null;
        const content = obj.data?.content;
        if (!content || content.dataType !== 'moveObject') return null;
        const f = content.fields as Record<string, unknown>;
        return {
          sessionObjectId,
          ownerAddress: String(f.owner),
          active: f.active === true,
          balanceAtomic: bigintField(f.balance),
          perCallCapAtomic: bigintField(f.per_call_cap),
          perDayCapAtomic: bigintField(f.per_day_cap),
          todaySpentAtomic: bigintField(f.today_spent),
          todayEpochDay: Number(f.today_epoch_day ?? 0),
          scopedServerObjectIds: Array.isArray(f.scoped_servers)
            ? (f.scoped_servers as unknown[]).map((x) => String(x))
            : [],
          expiresAtMs: f.expires_at_ms === null || f.expires_at_ms === undefined
            ? null
            : Number(f.expires_at_ms),
        };
      } catch (e) {
        throw new ChainError('rpc_unreachable', `getSession failed: ${(e as Error).message}`);
      }
    },

    async getPlatformConfig(): Promise<PlatformConfigView> {
      try {
        const obj = await client.getObject({
          id: env.platformConfigId,
          options: { showContent: true },
        });
        const content = obj.data?.content;
        if (!content || content.dataType !== 'moveObject') {
          throw new ChainError('rpc_unreachable', 'platform config object missing');
        }
        const f = content.fields as Record<string, unknown>;
        return {
          takeRateBps: Number(f.take_rate_bps),
          insuranceBps: Number(f.insurance_bps),
          subsidyAtomic: bigintField(f.subsidy_atomic),
          paused: f.paused === true,
        };
      } catch (e) {
        if (e instanceof ChainError) throw e;
        throw new ChainError('rpc_unreachable', `getPlatformConfig failed: ${(e as Error).message}`);
      }
    },

    async verifyEd25519(signatureB64, publicMessage, payerAddress): Promise<boolean> {
      // Sui addresses are blake2b-256 hashes of (scheme flag || pubkey); since
      // we don't have the pubkey separately from the signature payload, we
      // delegate to Sui's signature verifier which derives the address.
      const { verifyPersonalMessageSignature } = await import('@mysten/sui/verify');
      try {
        const recovered = await verifyPersonalMessageSignature(
          new TextEncoder().encode(publicMessage),
          signatureB64,
        );
        const got = recovered.toSuiAddress();
        return got.toLowerCase() === payerAddress.toLowerCase();
      } catch {
        // Try raw signature shape too. Some SDKs serialise differently.
        try {
          const _bytes = fromB64(signatureB64);
          return false; // conservative: refuse if standard verifier fails
        } catch {
          return false;
        }
      }
    },

    async submitSettle(params): Promise<SettleSubmitResult> {
      const tx = new Transaction();
      tx.setSender(gasStationKeypair.toSuiAddress());
      const enc = (s: string) =>
        Array.from(new TextEncoder().encode(s));
      if (params.intentId !== undefined) {
        // Intent-aware path (S6-T06). Same money movement as settle_call plus
        // post-receipt intent policy/counter enforcement on chain.
        tx.moveCall({
          target: `${env.mcpxPackageId}::settlement::settle_call_with_intent`,
          typeArguments: [env.usdsuiTypeTag],
          arguments: [
            tx.object(params.sessionObjectId),
            tx.object(params.serverObjectId),
            tx.object(env.platformConfigId),
            tx.object(env.treasuryId),
            tx.object(env.insuranceId),
            tx.object(params.intentId),
            tx.pure.string(params.toolName),
            tx.pure.vector('u8', enc(params.category ?? '')),
            tx.pure.u64(params.amountAtomic),
            tx.pure.vector('u8', enc(params.logBlobId)),
            tx.pure.bool(params.success),
            tx.object('0x6'), // Clock
          ],
        });
      } else {
        tx.moveCall({
          target: `${env.mcpxPackageId}::settlement::settle_call`,
          typeArguments: [env.usdsuiTypeTag],
          arguments: [
            tx.object(params.sessionObjectId),
            tx.object(params.serverObjectId),
            tx.object(env.platformConfigId),
            tx.object(env.treasuryId),
            tx.object(env.insuranceId),
            tx.pure.string(params.toolName),
            tx.pure.u64(params.amountAtomic),
            tx.pure.vector('u8', enc(params.logBlobId)),
            tx.pure.bool(params.success),
            tx.object('0x6'), // Clock
          ],
        });
      }
      try {
        const result = await client.signAndExecuteTransaction({
          transaction: tx,
          signer: gasStationKeypair,
          options: { showEffects: true, showEvents: true, showObjectChanges: true },
        });
        if (result.effects?.status?.status !== 'success') {
          const msg = result.effects?.status?.error ?? 'unknown chain error';
          if (msg.toLowerCase().includes('gas')) {
            throw new ChainError('gas_budget_exceeded', msg);
          }
          throw new ChainError('execution_failed', msg);
        }
        const receipt = result.objectChanges?.find(
          (c): c is typeof c & { type: 'created'; objectId: string; objectType: string } =>
            c.type === 'created' && c.objectType.includes('::settlement::CallReceipt'),
        );
        if (!receipt) {
          throw new ChainError('execution_failed', 'CallReceipt object not minted');
        }
        return {
          txDigest: result.digest,
          receiptObjectId: receipt.objectId,
          settledAmountAtomic: params.amountAtomic,
        };
      } catch (e) {
        if (e instanceof ChainError) throw e;
        throw new ChainError('execution_failed', `submitSettle failed: ${(e as Error).message}`);
      }
    },

    nowMs() {
      return Date.now();
    },

    todayEpochDay() {
      return Math.floor(Date.now() / 86_400_000);
    },
  };
}

function bigintField(v: unknown): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return BigInt(v);
  if (typeof v === 'string') return BigInt(v);
  return 0n;
}
