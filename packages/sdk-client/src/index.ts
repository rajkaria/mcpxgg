/**
 * @mcpxgg/sdk — consumer SDK for calling MCP servers through mcpxgg.
 *
 * Wired in Sprint 6.
 *
 * Usage (planned):
 *
 *   import { createMCPXClient } from '@mcpxgg/sdk';
 *
 *   const client = createMCPXClient({ apiKey: process.env.MCPX_API_KEY });
 *   const result = await client.callTool('walrus-search/query', { query: '...' });
 *   console.log(result.data);
 *   console.log(result.receipt); // { txDigest, blobId, amountAtomic, chain }
 */

export const SDK_VERSION = '0.1.0';

export interface CallToolResult {
  data: unknown;
  receipt: {
    txDigest: string;
    blobId: string;
    amountAtomic: bigint;
    chain: string;
  };
}

// Stub — Sprint 6
export function createMCPXClient(_opts: { apiKey: string; intentId?: string }): never {
  throw new Error('createMCPXClient — wired in Sprint 6, see docs/SPRINTS.md');
}
