// ---------------------------------------------------------------------------
// MCPX Starter Template - Test Harness
// ---------------------------------------------------------------------------
// Exercises all registered tools by calling tools/list, then invoking each
// tool with sample arguments and validating the responses.
//
// Usage:  npm run test
// ---------------------------------------------------------------------------

import { handleMcpRequest } from "../src/lib/mcp-handler.js";
import type { McpRequest, McpResponse } from "../src/lib/types.js";

// ---------------------------------------------------------------------------
// Sample arguments for known tools
// ---------------------------------------------------------------------------
const SAMPLE_ARGS: Record<string, Record<string, unknown>> = {
  echo: { message: "Hello from the test harness!" },
  random_number: { min: 1, max: 100 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ""}`);
    failed++;
  }
}

async function send(req: Partial<McpRequest>): Promise<McpResponse> {
  return handleMcpRequest({
    jsonrpc: "2.0",
    method: "",
    ...req,
  } as McpRequest);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function testInitialize(): Promise<void> {
  console.log("\n--- initialize ---");
  const res = await send({ id: 1, method: "initialize" });
  assert(res.result !== undefined, "returns a result");
  const result = res.result as Record<string, unknown>;
  assert(typeof result.protocolVersion === "string", "has protocolVersion");
  assert(typeof result.serverInfo === "object", "has serverInfo");
  assert(typeof result.capabilities === "object", "has capabilities");
}

async function testPing(): Promise<void> {
  console.log("\n--- ping ---");
  const res = await send({ id: 2, method: "ping" });
  assert(res.result !== undefined, "returns a result");
  assert(res.error === undefined, "no error");
}

async function testToolsList(): Promise<string[]> {
  console.log("\n--- tools/list ---");
  const res = await send({ id: 3, method: "tools/list" });
  assert(res.result !== undefined, "returns a result");

  const result = res.result as { tools: { name: string; description: string; inputSchema: unknown }[] };
  assert(Array.isArray(result.tools), "result.tools is an array");
  assert(result.tools.length > 0, `found ${result.tools.length} tool(s)`);

  for (const tool of result.tools) {
    assert(typeof tool.name === "string" && tool.name.length > 0, `tool "${tool.name}" has a name`);
    assert(typeof tool.description === "string", `tool "${tool.name}" has a description`);
    assert(typeof tool.inputSchema === "object", `tool "${tool.name}" has an inputSchema`);
  }

  return result.tools.map((t) => t.name);
}

async function testToolCall(toolName: string): Promise<void> {
  console.log(`\n--- tools/call: ${toolName} ---`);

  const args = SAMPLE_ARGS[toolName];
  if (!args) {
    console.log(`  SKIP  no sample args defined for "${toolName}"`);
    return;
  }

  const res = await send({
    id: 100,
    method: "tools/call",
    params: { name: toolName, arguments: args },
  });

  assert(res.error === undefined, "no error in response");

  const result = res.result as { content?: { type: string; text: string }[]; isError?: boolean } | undefined;
  assert(result !== undefined, "has a result");
  assert(Array.isArray(result?.content), "result has content array");
  assert(result?.content?.[0]?.type === "text", "first content item is text");
  assert(typeof result?.content?.[0]?.text === "string", "text is a string");
  assert(result?.isError !== true, "isError is not true");

  console.log(`  Output: ${result?.content?.[0]?.text}`);
}

async function testInvalidTool(): Promise<void> {
  console.log("\n--- tools/call: unknown tool ---");
  const res = await send({
    id: 200,
    method: "tools/call",
    params: { name: "nonexistent_tool", arguments: {} },
  });
  assert(res.error !== undefined, "returns an error for unknown tool");
}

async function testInvalidArgs(): Promise<void> {
  console.log("\n--- tools/call: invalid arguments ---");
  const res = await send({
    id: 201,
    method: "tools/call",
    params: { name: "echo", arguments: {} }, // missing required "message"
  });
  // Should return a result with error details (validation failure)
  assert(res.error !== undefined, "returns error for missing required args");
}

async function testUnknownMethod(): Promise<void> {
  console.log("\n--- unknown method ---");
  const res = await send({ id: 300, method: "foo/bar" });
  assert(res.error !== undefined, "returns an error");
  assert(res.error?.code === -32601, "error code is -32601 (method not found)");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("==============================================");
  console.log("  MCPX MCP Server - Test Harness");
  console.log("==============================================");

  await testInitialize();
  await testPing();
  const toolNames = await testToolsList();

  for (const name of toolNames) {
    await testToolCall(name);
  }

  await testInvalidTool();
  await testInvalidArgs();
  await testUnknownMethod();

  console.log("\n==============================================");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("==============================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test harness crashed:", err);
  process.exit(1);
});
