/**
 * @mcpxgg/chain — Chain Abstraction Layer
 *
 * Public exports. The web app, gateway, facilitator, indexer, and CLI all
 * import from this package. No file outside `packages/chain/` should import
 * `@mysten/sui` directly — go through ChainAdapter.
 */

export * from './types';
export { SuiAdapter } from './sui-adapter';
export { InMemorySuiAdapter } from './in-memory-adapter';
export { getActiveChain, CHAINS, type ChainRegistry } from './registry';
export { isSuiAddress, normalizeSuiAddress } from './sui/address';
export {
  buildCreateSessionAndDepositTx,
  buildDepositTx,
  buildWithdrawTx,
  buildPublishServerTx,
  buildAddToolsTx,
  buildCreateBundleTx,
  buildActivateBundleTx,
  buildCreateIntentTx,
  buildRevokeIntentTx,
  buildAttestQualityTx,
  buildPostStakeTx,
  buildTopUpStakeTx,
  buildWithdrawStakeTx,
  buildSlashStakeTx,
  buildClaimFailedCallTx,
  buildTopUpInsuranceTx,
  SLA_TIER_UPTIME_X100,
  type SlaTier,
  type AttestQualityArgs,
  type SuiTxConfig,
  type BuiltTx,
  type PublishToolInput,
} from './sui/tx-builder';
export {
  signAndExecuteBase64Tx,
  addressFromPrivateKey,
  type SignAndExecuteParams,
  type SignAndExecuteResult,
  type CreatedObject,
} from './sui/signer';
