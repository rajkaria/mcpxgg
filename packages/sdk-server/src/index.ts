/**
 * @mcpxgg/server — SDK for developers building MCP servers on mcpxgg.
 *
 *   import { createMCPXServer } from '@mcpxgg/server';
 *
 *   const server = createMCPXServer({ namespace: 'my-server' });
 *   server.tool('analyze', {
 *     description: 'Analyze something',
 *     inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
 *     pricing: { perCallAtomic: 5_000n }, // 0.005 USDsui
 *     handler: async (args, ctx) => {
 *       // ctx.payerAddress / ctx.txDigest populated post-settlement by the gateway
 *       return { result: '...' };
 *     },
 *   });
 *   server.listen(3000);
 */

export { createMCPXServer, SDK_VERSION } from './server.js';
export type { MCPXServer } from './server.js';
export type {
  MCPXServerOptions,
  ToolDefinition,
  ToolHandler,
  ToolContext,
  ToolPricing,
  ToolResult,
  RegisteredTool,
  ServerManifest,
} from './types.js';
