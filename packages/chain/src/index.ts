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
  type SuiTxConfig,
  type BuiltTx,
} from './sui/tx-builder';
