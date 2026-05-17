import { NextRequest, NextResponse } from "next/server";

/**
 * S3-T11: this route is now a thin reverse proxy to the standalone gateway
 * service at `mcp.mcpx.gg` (apps/gateway). The chain-backed gateway logic
 * lives there; mcpx.gg keeps `/api/mcp` working for backward compatibility
 * with already-distributed client configs.
 */

const GATEWAY_URL = process.env.GATEWAY_URL ?? "https://mcp.mcpx.gg";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const bodyText = await request.text();
  const headers: Record<string, string> = { "content-type": "application/json" };
  const auth = request.headers.get("authorization");
  const apiKey = request.headers.get("x-api-key");
  if (auth) headers.authorization = auth;
  if (apiKey) headers["x-api-key"] = apiKey;

  try {
    const upstream = await fetch(`${GATEWAY_URL}/`, {
      method: "POST",
      headers,
      body: bodyText,
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        ...CORS_HEADERS,
        "content-type": upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (err) {
    console.error("[api/mcp] gateway proxy failed:", err);
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32603, message: "Gateway unreachable" },
      },
      { status: 502, headers: CORS_HEADERS },
    );
  }
}
