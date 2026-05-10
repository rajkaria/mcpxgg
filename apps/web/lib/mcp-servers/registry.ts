/**
 * Internal MCP Server Registry.
 *
 * Maps namespace → handler function for servers that run in-process
 * (rather than as external HTTP endpoints).
 *
 * Handlers are registered here and populated in SP7.
 */

export type InternalHandler = (
  toolName: string,
  args: Record<string, unknown>
) => Promise<{
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}>;

const registry = new Map<string, InternalHandler>();

/**
 * Registers an internal MCP server handler.
 */
export function registerInternalServer(namespace: string, handler: InternalHandler): void {
  registry.set(namespace, handler);
}

/**
 * Retrieves the handler for an internal server by namespace.
 */
export function getInternalHandler(namespace: string): InternalHandler | undefined {
  return registry.get(namespace);
}

/**
 * Returns all registered internal server namespaces.
 */
export function getRegisteredNamespaces(): string[] {
  return Array.from(registry.keys());
}
