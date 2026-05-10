import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey, AuthError } from "@/lib/gateway/auth";
import { handleMcpRequest } from "@/lib/gateway/handler";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * OPTIONS handler for CORS preflight.
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

/**
 * POST /api/mcp
 *
 * Main MCP protocol endpoint.
 * Accepts JSON-RPC requests, authenticates via Authorization header,
 * and delegates to the gateway handler.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse body
    const body = await request.json() as any;

    if (!body || !body.jsonrpc || !body.method) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: body?.id ?? null,
          error: {
            code: -32600,
            message: "Invalid JSON-RPC request: missing jsonrpc or method",
          },
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Extract API key from Authorization header
    const authHeader = request.headers.get("Authorization") || "";
    const apiKey = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : authHeader.trim();

    // Authenticate
    const auth = await authenticateApiKey(apiKey);

    // Handle the MCP request
    const response = await handleMcpRequest(body, auth);

    return NextResponse.json(response, {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (err: any) {
    // Handle authentication errors
    if (err instanceof AuthError) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32009,
            message: err.message,
            data: { error_code: err.code },
          },
        },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // Handle JSON parse errors
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "Parse error: invalid JSON",
          },
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Unexpected error
    console.error("[api/mcp] Unhandled error:", err);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: "Internal server error",
        },
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
