// ---------------------------------------------------------------------------
// MCPX Starter Template - Netlify Functions Adapter
// ---------------------------------------------------------------------------
// Deploys the MCP handler as a Netlify Function.
//
// Netlify automatically discovers this file when the functions directory
// is set in netlify.toml.  The function is invoked at /.netlify/functions/mcp
// (or /mcp if you configure a redirect in netlify.toml).
// ---------------------------------------------------------------------------

import { handleMcpRequest } from "../lib/mcp-handler.js";
import type { McpRequest } from "../lib/types.js";

interface NetlifyEvent {
  httpMethod: string;
  body: string | null;
  headers: Record<string, string>;
}

interface NetlifyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

export async function handler(event: NetlifyEvent): Promise<NetlifyResponse> {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  // Only accept POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body: McpRequest = JSON.parse(event.body ?? "{}");
    const response = await handleMcpRequest(body);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(response),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32700, message: `Parse error: ${message}` },
      }),
    };
  }
}
