// ---------------------------------------------------------------------------
// MCPX Starter Template - Vercel Serverless Adapter
// ---------------------------------------------------------------------------
// Deploys the MCP handler as a Vercel Serverless Function.
//
// Vercel expects a default export from files inside api/.
// Use vercel.json to rewrite /mcp -> /api/mcp so the endpoint URL stays
// clean.
// ---------------------------------------------------------------------------

import { handleMcpRequest } from "../lib/mcp-handler.js";
import type { McpRequest } from "../lib/types.js";

interface VercelRequest {
  method: string;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  status(code: number): VercelResponse;
  setHeader(name: string, value: string): VercelResponse;
  json(body: unknown): void;
  end(): void;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function setCorsHeaders(res: VercelResponse): void {
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.setHeader(key, value);
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // Only accept POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body as McpRequest;
    const response = await handleMcpRequest(body);
    res.status(200).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({
      jsonrpc: "2.0",
      error: { code: -32700, message: `Parse error: ${message}` },
    });
  }
}
