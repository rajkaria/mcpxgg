// ---------------------------------------------------------------------------
// MCPX Starter Template - Example Tools
// ---------------------------------------------------------------------------
// This file ships two simple tools that demonstrate the ToolDefinition
// contract.  Use them as a reference when building your own tools.
// ---------------------------------------------------------------------------

import type { ToolDefinition } from "../lib/types.js";

// ---------------------------------------------------------------------------
// Tool 1: echo
// ---------------------------------------------------------------------------
const echo: ToolDefinition = {
  name: "echo",
  description: "Echo a message back. Useful for testing connectivity.",
  creditCost: 1,
  timeoutSeconds: 5,
  inputSchema: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "The message to echo back",
      },
    },
    required: ["message"],
  },

  async execute(args) {
    const message = args.message as string;
    return message;
  },
};

// ---------------------------------------------------------------------------
// Tool 2: random_number
// ---------------------------------------------------------------------------
const randomNumber: ToolDefinition = {
  name: "random_number",
  description: "Generate a random number between min and max (inclusive).",
  creditCost: 1,
  timeoutSeconds: 5,
  inputSchema: {
    type: "object",
    properties: {
      min: {
        type: "number",
        description: "Minimum value (inclusive)",
      },
      max: {
        type: "number",
        description: "Maximum value (inclusive)",
      },
    },
    required: ["min", "max"],
  },

  async execute(args) {
    const min = args.min as number;
    const max = args.max as number;

    if (min > max) {
      throw new Error("min must be less than or equal to max");
    }

    const result = Math.floor(Math.random() * (max - min + 1)) + min;
    return String(result);
  },
};

// ---------------------------------------------------------------------------
// Export all tools from this module
// ---------------------------------------------------------------------------
export default [echo, randomNumber] satisfies ToolDefinition[];
