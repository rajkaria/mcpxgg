import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/mcp/test
 *
 * Tests the user's MCP gateway connection by sending an initialize request.
 * Used by the setup wizard to verify the user's config is working.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Get user's API key
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await supabase
    .from("users")
    .select("api_key")
    .eq("id", user.id)
    .single() as any;

  if (!userData?.api_key) {
    return NextResponse.json(
      { success: false, error: "No API key found. Please generate one in settings." },
      { status: 400 }
    );
  }

  try {
    // Send an initialize request to our own MCP endpoint
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const response = await fetch(`${appUrl}/api/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userData.api_key}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: process.env.MCP_PROTOCOL_VERSION || "2025-03-26",
          capabilities: {},
          clientInfo: {
            name: "mcpx-test",
            version: "1.0.0",
          },
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({
        success: false,
        error: `Gateway returned ${response.status}: ${text}`,
      });
    }

    const data = await response.json();

    if (data.error) {
      return NextResponse.json({
        success: false,
        error: data.error.message || "Gateway returned an error",
      });
    }

    return NextResponse.json({
      success: true,
      serverInfo: data.result?.serverInfo || null,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: "Failed to connect to gateway. Please check your configuration.",
    });
  }
}
