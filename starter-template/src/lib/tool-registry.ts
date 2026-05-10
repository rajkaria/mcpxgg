// ---------------------------------------------------------------------------
// MCPX Starter Template - Tool Registry
// ---------------------------------------------------------------------------
// Auto-discovers tool files under src/tools/ at import time.
//
// Convention:
//   - Each file in src/tools/ must `export default` an array of ToolDefinition.
//   - Files whose name starts with "_" (e.g. _template.ts) are skipped.
//   - The registry deduplicates by tool name (last-wins).
// ---------------------------------------------------------------------------

import type { ToolDefinition } from "./types.js";

// ---- Static imports for all tool modules -----------------------------------
// We use explicit static imports instead of dynamic import() / fs.readdir so
// that bundlers (Netlify, Vercel, etc.) can tree-shake and include everything
// at build time without requiring a Node.js filesystem at runtime.
//
// To add a new tool file, import it here and spread it into `ALL_MODULES`.
// ---------------------------------------------------------------------------

import exampleTools from "../tools/example.js";

/**
 * Aggregate every tool module here.  Each entry must be a ToolDefinition[].
 * When you create a new file in src/tools/, import it above and add it below.
 */
const ALL_MODULES: ToolDefinition[][] = [
  exampleTools,
];

// ---- Registry logic --------------------------------------------------------

const registry: Map<string, ToolDefinition> = new Map();

for (const toolArray of ALL_MODULES) {
  for (const tool of toolArray) {
    registry.set(tool.name, tool);
  }
}

/**
 * Return every registered tool.
 */
export function getTools(): ToolDefinition[] {
  return Array.from(registry.values());
}

/**
 * Look up a single tool by its unique name.
 */
export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}
