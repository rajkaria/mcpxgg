// ---------------------------------------------------------------------------
// MCPX Starter Template - Tool Template
// ---------------------------------------------------------------------------
//
// HOW TO CREATE A NEW TOOL
// ========================
//
// 1. Copy this file and rename it (e.g. `weather.ts`, `translate.ts`).
//
// 2. Define one or more ToolDefinition objects (see below).
//
// 3. Export them as a default array:
//
//      export default [myTool] satisfies ToolDefinition[];
//
// 4. Register the new file in src/lib/tool-registry.ts:
//
//      import weatherTools from "../tools/weather.js";
//
//      const ALL_MODULES: ToolDefinition[][] = [
//        exampleTools,
//        weatherTools,   // <-- add here
//      ];
//
// 5. Run `npm run dev` to test, then `npm run generate-config` to update
//    mcpx.config.json before publishing.
//
// ---------------------------------------------------------------------------
//
// CREDIT COST GUIDELINES
// ======================
//
//   1 credit  - Simple / read-only operations (echo, lookup, format)
//   3 credits - External API calls (fetch data, send notification)
//  10 credits - AI / compute-heavy operations (generate image, run model)
//
// Choose the cost that best reflects the resource intensity of the tool.
//
// ---------------------------------------------------------------------------
//
// INPUT SCHEMA
// ============
//
// The `inputSchema` field uses JSON Schema (draft-07 style).  Common types:
//
//   { type: "string" }                     - a string value
//   { type: "number" }                     - any number
//   { type: "integer" }                    - whole numbers only
//   { type: "boolean" }                    - true / false
//   { type: "array", items: { ... } }      - an array of items
//   { type: "object", properties: { ... }} - a nested object
//
// You can add `description`, `minimum`, `maximum`, `minLength`, `maxLength`,
// `pattern`, and `enum` constraints to any property.
//
// The `required` array at the top level lists which properties are mandatory.
//
// ---------------------------------------------------------------------------
//
// EXECUTE FUNCTION
// ================
//
// The `execute` function receives the validated arguments as a plain object.
// It must return a Promise<string>.
//
// - Return the result as a human-readable string.
// - Throw an Error if something goes wrong -- the framework catches it and
//   returns it as an MCP error response.
// - You can access environment variables via `process.env.MY_API_KEY`.
// - Keep execution time under the `timeoutSeconds` limit.
//
// ---------------------------------------------------------------------------

import type { ToolDefinition } from "../lib/types.js";

// ---------------------------------------------------------------------------
// Example: a placeholder tool (disabled - not exported)
// ---------------------------------------------------------------------------
// Uncomment and modify this to create your own tool.
//
// const myTool: ToolDefinition = {
//   name: "my_tool",
//   description: "Describe what this tool does in one sentence.",
//   creditCost: 1,         // 1, 3, or 10
//   timeoutSeconds: 10,    // optional, defaults to 30
//   inputSchema: {
//     type: "object",
//     properties: {
//       query: {
//         type: "string",
//         description: "The search query",
//       },
//       limit: {
//         type: "integer",
//         description: "Maximum number of results",
//         minimum: 1,
//         maximum: 100,
//       },
//     },
//     required: ["query"],
//   },
//
//   async execute(args) {
//     const query = args.query as string;
//     const limit = (args.limit as number) ?? 10;
//
//     // ------ Your logic here ------
//     // const apiKey = process.env.MY_API_KEY;
//     // const response = await fetch(`https://api.example.com/search?q=${query}&limit=${limit}`, {
//     //   headers: { Authorization: `Bearer ${apiKey}` },
//     // });
//     // const data = await response.json();
//     // return JSON.stringify(data.results);
//     // -----------------------------
//
//     return `Searched for "${query}" with limit ${limit}`;
//   },
// };

// ---------------------------------------------------------------------------
// Export all tools from this module.
// This file exports an empty array because the template tool is disabled.
// When you create your own tool, uncomment the definition above and add it
// to the array below.
// ---------------------------------------------------------------------------
export default [] satisfies ToolDefinition[];
