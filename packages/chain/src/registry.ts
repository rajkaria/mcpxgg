/**
 * Chain registry. Today: Sui only. Tomorrow: Sui + Base + Solana.
 *
 * `getActiveChain()` is the primary import for app/route code. UI components
 * never reach into the SuiAdapter directly — they go through this getter.
 */

import { SuiAdapter } from './sui-adapter';
import type { ChainAdapter, ChainId } from './types';

export type ChainRegistry = Record<ChainId, ChainAdapter | undefined>;

export const CHAINS: ChainRegistry = {
  sui: new SuiAdapter(),
  base: undefined, // post-hackathon
  solana: undefined, // post-hackathon
};

/**
 * Returns the chain adapter for the user's active chain. Today this is
 * hard-coded to Sui. Post-hackathon, this will read from user preference.
 */
export function getActiveChain(): ChainAdapter {
  const sui = CHAINS.sui;
  if (!sui) throw new Error('No chain adapter registered');
  return sui;
}
