/**
 * In-memory GatewayStore for tests and local dev. Seed via the helpers.
 */

import type {
  AuthContext,
  GatewayStore,
  ResolvedServer,
  ResolvedTool,
} from './store.js';

export interface InMemoryGatewayStore extends GatewayStore {
  setAuth(apiKey: string, ctx: AuthContext): void;
  setServer(server: ResolvedServer): void;
  setTool(serverObjectId: string, tool: ResolvedTool): void;
}

export function createInMemoryStore(): InMemoryGatewayStore {
  const auths = new Map<string, AuthContext>();
  const serversByNs = new Map<string, ResolvedServer>();
  const toolsByServer = new Map<string, Map<string, ResolvedTool>>();

  return {
    async getAuthByApiKey(apiKey) {
      return auths.get(apiKey) ?? null;
    },
    async resolveServer(namespace) {
      return serversByNs.get(namespace) ?? null;
    },
    async resolveTool(serverObjectId, toolName) {
      return toolsByServer.get(serverObjectId)?.get(toolName) ?? null;
    },
    async listTools(serverObjectId) {
      return [...(toolsByServer.get(serverObjectId)?.values() ?? [])];
    },
    async listScopedServers(auth) {
      const all = [...serversByNs.values()].filter((s) => s.active);
      if (auth.scopedServerObjectIds.length === 0) return all;
      const allow = new Set(auth.scopedServerObjectIds);
      return all.filter((s) => allow.has(s.serverObjectId));
    },

    setAuth(apiKey, ctx) {
      auths.set(apiKey, ctx);
    },
    setServer(server) {
      serversByNs.set(server.namespace, server);
    },
    setTool(serverObjectId, tool) {
      let m = toolsByServer.get(serverObjectId);
      if (!m) {
        m = new Map();
        toolsByServer.set(serverObjectId, m);
      }
      m.set(tool.toolName, tool);
    },
  };
}
