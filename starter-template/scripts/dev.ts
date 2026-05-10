// ---------------------------------------------------------------------------
// MCPX Starter Template - Development Server
// ---------------------------------------------------------------------------
// Starts an Express server on port 3000 with CORS enabled.
// Routes POST /mcp to the MCP handler.
//
// Usage:  npm run dev
// ---------------------------------------------------------------------------

import express from "express";
import { handleMcpRequest } from "../src/lib/mcp-handler.js";
import type { McpRequest } from "../src/lib/types.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// Parse JSON bodies
app.use(express.json());

// CORS - allow all origins in development
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// Handle preflight
app.options("/mcp", (_req, res) => {
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Health check
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    server: "mcpx-mcp-server",
    version: "1.0.0",
    endpoints: {
      mcp: "POST /mcp",
    },
  });
});

// MCP endpoint
app.post("/mcp", async (req, res) => {
  try {
    const body = req.body as McpRequest;
    const response = await handleMcpRequest(body);
    res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({
      jsonrpc: "2.0",
      error: { code: -32700, message: `Parse error: ${message}` },
    });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`\n  MCPX MCP Dev Server running at http://localhost:${PORT}`);
  console.log(`  MCP endpoint: POST http://localhost:${PORT}/mcp`);
  console.log(`\n  Try it:`);
  console.log(`    curl -X POST http://localhost:${PORT}/mcp \\`);
  console.log(`      -H "Content-Type: application/json" \\`);
  console.log(`      -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`);
  console.log();
});
