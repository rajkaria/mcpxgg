/**
 * @mcpxgg/server — SDK for developers building MCP servers on mcpxgg.
 *
 * Wired in Sprint 3.
 *
 * Usage (planned):
 *
 *   import { createMCPXServer } from '@mcpxgg/server';
 *
 *   const server = createMCPXServer({ namespace: 'my-server' });
 *   server.tool('analyze', {
 *     description: 'Analyze something',
 *     inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
 *     pricing: { perCallAtomic: 5_000n }, // 0.005 USDsui
 *     handler: async (args, ctx) => {
 *       // ctx.payerAddress, ctx.txDigest populated post-settlement
 *       return { result: '...' };
 *     },
 *   });
 *   server.listen(3000);
 */

export const SDK_VERSION = '0.1.0';

export function createMCPXServer(_opts: { namespace: string }): never {
  throw new Error('createMCPXServer — wired in Sprint 3, see docs/SPRINTS.md');
}
