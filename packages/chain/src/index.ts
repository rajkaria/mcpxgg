/**
 * @mcpxgg/chain — Chain Abstraction Layer
 *
 * Public exports. The web app, gateway, facilitator, indexer, and CLI all
 * import from this package. No file outside `packages/chain/` should import
 * `@mysten/sui` directly — go through ChainAdapter.
 */

export * from './types';
export { SuiAdapter } from './sui-adapter';
export { getActiveChain, CHAINS, type ChainRegistry } from './registry';
