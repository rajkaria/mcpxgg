// ---------------------------------------------------------------------------
// MCPX Starter Template - Config Generator
// ---------------------------------------------------------------------------
// Reads the tool registry and generates / updates mcpx.config.json with the
// current tool metadata (name, description, creditCost, timeoutSeconds,
// inputSchema).
//
// Usage:  npm run generate-config
// ---------------------------------------------------------------------------

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { getTools } from "../src/lib/tool-registry.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.resolve(__dirname, "..", "mcpx.config.json");

interface McpxConfigTool {
  name: string;
  description: string;
  creditCost: number;
  timeoutSeconds: number;
  inputSchema?: Record<string, unknown>;
}

interface McpxConfig {
  namespace: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  triggerPhrases: string[];
  endpointUrl: string;
  tools: McpxConfigTool[];
}

function main(): void {
  // Load existing config or create a skeleton
  let config: McpxConfig;

  if (fs.existsSync(CONFIG_PATH)) {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    config = JSON.parse(raw) as McpxConfig;
    console.log("  Loaded existing mcpx.config.json");
  } else {
    config = {
      namespace: "my-server",
      name: "My MCP Server",
      description: "A starter MCP server built with MCPX.",
      category: "other",
      tags: ["starter"],
      triggerPhrases: ["use my server"],
      endpointUrl: "https://my-server.netlify.app/mcp",
      tools: [],
    };
    console.log("  Created new mcpx.config.json skeleton");
  }

  // Rebuild the tools array from the live registry
  const tools = getTools();
  config.tools = tools.map((t) => ({
    name: t.name,
    description: t.description,
    creditCost: t.creditCost,
    timeoutSeconds: t.timeoutSeconds ?? 30,
    inputSchema: t.inputSchema,
  }));

  // Write
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf-8");

  console.log(`  Wrote ${config.tools.length} tool(s) to mcpx.config.json`);
  for (const tool of config.tools) {
    console.log(`    - ${tool.name} (${tool.creditCost} credit${tool.creditCost > 1 ? "s" : ""})`);
  }
  console.log();
}

main();
