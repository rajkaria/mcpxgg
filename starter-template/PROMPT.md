# MCPX MCP Server - AI Build Guide

> Feed this entire file to Claude (or another AI assistant) to get help
> building and extending your MCP server. It contains everything the AI needs
> to understand the project structure, conventions, and deployment process.

---

## Table of Contents

1. [What is MCP?](#1-what-is-mcp)
2. [Project Overview](#2-project-overview)
3. [Directory Structure](#3-directory-structure)
4. [Core Concepts](#4-core-concepts)
5. [Creating New Tools](#5-creating-new-tools)
6. [The ToolDefinition Interface](#6-the-tooldefinition-interface)
7. [Input Schema Reference](#7-input-schema-reference)
8. [Credit Cost Guidelines](#8-credit-cost-guidelines)
9. [Accessing Environment Variables](#9-accessing-environment-variables)
10. [Running the Dev Server](#10-running-the-dev-server)
11. [Testing Your Tools](#11-testing-your-tools)
12. [Generating and Validating Config](#12-generating-and-validating-config)
13. [Deploying to Netlify](#13-deploying-to-netlify)
14. [Deploying to Vercel](#14-deploying-to-vercel)
15. [Publishing on MCPX](#15-publishing-on-mcpx)
16. [Error Handling](#16-error-handling)
17. [Advanced Patterns](#17-advanced-patterns)
18. [Troubleshooting](#18-troubleshooting)
19. [Full Example: Weather Tool](#19-full-example-weather-tool)
20. [Full Example: Database Lookup Tool](#20-full-example-database-lookup-tool)

---

## 1. What is MCP?

MCP (Model Context Protocol) is an open standard that lets AI assistants call
external tools over HTTP. Think of it like a REST API, but designed
specifically for AI-to-tool communication.

The protocol uses JSON-RPC 2.0. An AI assistant sends a request like:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "echo",
    "arguments": { "message": "hello" }
  }
}
```

Your server processes the request and returns:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "hello" }]
  }
}
```

The MCPX platform acts as a gateway between AI assistants and your MCP
server. It handles authentication, credit billing, rate limiting, and
discovery. You just write the tools.

---

## 2. Project Overview

This is a TypeScript + Node.js project that implements an MCP server. It
includes:

- **Tool framework** -- define tools with typed inputs and async execution
- **MCP protocol handler** -- handles JSON-RPC routing and validation
- **Platform adapters** -- deploy to Netlify, Vercel, or any Node.js host
- **Dev server** -- Express-based local server for testing
- **Test harness** -- automated test runner for all tools
- **Config generator** -- creates the mcpx.config.json the platform needs

The project uses ESM modules with TypeScript's NodeNext module resolution.
All import paths use `.js` extensions (TypeScript resolves `.ts` files
automatically when the extension is `.js` in NodeNext mode).

---

## 3. Directory Structure

```
starter-template/
  mcpx.config.json          -- MCPX platform configuration
  package.json              -- Node.js project configuration
  tsconfig.json             -- TypeScript compiler configuration
  netlify.toml              -- Netlify deployment configuration
  vercel.json               -- Vercel deployment configuration
  .env.example              -- Example environment variables
  PROMPT.md                 -- This file (AI build guide)
  README.md                 -- Human-readable quickstart

  scripts/
    dev.ts                  -- Express development server
    test.ts                 -- Automated test harness
    generate-config.ts      -- Generate mcpx.config.json from tools
    validate.ts             -- Validate mcpx.config.json

  src/
    lib/
      types.ts              -- Core TypeScript type definitions
      validation.ts         -- Zod-based input validation
      tool-registry.ts      -- Tool discovery and registry
      mcp-handler.ts        -- MCP JSON-RPC protocol handler

    tools/
      _template.ts          -- Template for creating new tools
      example.ts            -- Example tools (echo, random_number)

    adapters/
      netlify.ts            -- Netlify Functions adapter
      vercel.ts             -- Vercel Serverless adapter
```

---

## 4. Core Concepts

### Tools

A **tool** is a single function that an AI assistant can call. Each tool has:
- A unique name (snake_case)
- A description explaining what it does
- A credit cost (1, 3, or 10)
- An input schema defining what arguments it accepts
- An async execute function that does the work

### Tool Registry

The **tool registry** (`src/lib/tool-registry.ts`) collects all tools from
the `src/tools/` directory. When you create a new tool file, you must:

1. Export a default array of ToolDefinition objects
2. Import and register the file in `src/lib/tool-registry.ts`

### MCP Handler

The **MCP handler** (`src/lib/mcp-handler.ts`) routes incoming JSON-RPC
requests to the correct handler. It supports four methods:

| Method        | Purpose                                    |
|---------------|--------------------------------------------|
| `initialize`  | Handshake: returns server info and caps     |
| `ping`        | Health check: returns empty result          |
| `tools/list`  | Returns all registered tool definitions     |
| `tools/call`  | Validates input and executes a named tool   |

### Adapters

**Adapters** translate between a hosting platform's request/response format
and the MCP handler. There are adapters for Netlify Functions and Vercel
Serverless Functions. For local development, the Express dev server in
`scripts/dev.ts` serves the same role.

---

## 5. Creating New Tools

Follow these steps to add a new tool:

### Step 1: Create the tool file

Copy `src/tools/_template.ts` to a new file:

```bash
cp src/tools/_template.ts src/tools/weather.ts
```

### Step 2: Define your tool

Open `src/tools/weather.ts` and define your tool:

```typescript
import type { ToolDefinition } from "../lib/types.js";

const getWeather: ToolDefinition = {
  name: "get_weather",
  description: "Get the current weather for a city.",
  creditCost: 3,
  timeoutSeconds: 15,
  inputSchema: {
    type: "object",
    properties: {
      city: {
        type: "string",
        description: "The city name (e.g. 'San Francisco')",
      },
    },
    required: ["city"],
  },

  async execute(args) {
    const city = args.city as string;
    const apiKey = process.env.WEATHER_API_KEY;

    if (!apiKey) {
      throw new Error("WEATHER_API_KEY not set");
    }

    const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(city)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Weather API returned ${response.status}`);
    }

    const data = await response.json();
    return JSON.stringify({
      city: data.location.name,
      temperature: data.current.temp_c,
      condition: data.current.condition.text,
    });
  },
};

export default [getWeather] satisfies ToolDefinition[];
```

### Step 3: Register the tool

Open `src/lib/tool-registry.ts` and add your import:

```typescript
import exampleTools from "../tools/example.js";
import weatherTools from "../tools/weather.js";

const ALL_MODULES: ToolDefinition[][] = [
  exampleTools,
  weatherTools,   // <-- add here
];
```

### Step 4: Test

```bash
npm run dev    # Start the dev server
npm run test   # Run the test harness
```

### Step 5: Update config

```bash
npm run generate-config   # Regenerate mcpx.config.json
npm run validate           # Validate the config
```

---

## 6. The ToolDefinition Interface

Every tool must conform to this TypeScript interface:

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  creditCost: 1 | 3 | 10;
  timeoutSeconds?: number;
  inputSchema: JsonSchema;
  execute(args: Record<string, unknown>): Promise<string>;
}
```

### Field reference

| Field            | Type                              | Required | Description                                    |
|------------------|-----------------------------------|----------|------------------------------------------------|
| `name`           | `string`                          | Yes      | Unique snake_case identifier                   |
| `description`    | `string`                          | Yes      | Human-readable description for AI discovery    |
| `creditCost`     | `1 \| 3 \| 10`                   | Yes      | Credits consumed per invocation                |
| `timeoutSeconds` | `number`                          | No       | Max execution time (default: 30, max: 60)      |
| `inputSchema`    | `Record<string, unknown>`         | Yes      | JSON Schema for input validation               |
| `execute`        | `(args) => Promise<string>`       | Yes      | Async function that performs the work           |

### Rules

- `name` must be unique across all tools in the server
- `name` should use snake_case (e.g. `get_weather`, not `getWeather`)
- `description` should be clear and concise -- AI models use it for discovery
- `execute` must always return a string (use `JSON.stringify` for objects)
- `execute` should throw an Error on failure (do not return error strings)

---

## 7. Input Schema Reference

The `inputSchema` follows JSON Schema conventions. Here are common patterns:

### String parameter

```typescript
{
  type: "object",
  properties: {
    query: {
      type: "string",
      description: "Search query",
      minLength: 1,
      maxLength: 500,
    },
  },
  required: ["query"],
}
```

### Number parameter with range

```typescript
{
  type: "object",
  properties: {
    count: {
      type: "integer",
      description: "Number of items",
      minimum: 1,
      maximum: 100,
    },
  },
  required: ["count"],
}
```

### Enum (fixed choices)

```typescript
{
  type: "object",
  properties: {
    format: {
      type: "string",
      enum: ["json", "csv", "text"],
      description: "Output format",
    },
  },
  required: ["format"],
}
```

### Optional parameters

Simply omit the property name from the `required` array:

```typescript
{
  type: "object",
  properties: {
    query: { type: "string", description: "Search query" },
    limit: { type: "integer", description: "Max results (default 10)" },
  },
  required: ["query"],  // "limit" is optional
}
```

### Boolean flag

```typescript
{
  type: "object",
  properties: {
    includeMetadata: {
      type: "boolean",
      description: "Whether to include metadata in the response",
    },
  },
  required: [],
}
```

---

## 8. Credit Cost Guidelines

Every tool invocation consumes credits from the user's MCPX balance. Choose
the credit cost that reflects the resource intensity of the operation:

| Cost       | Use When                                                    | Examples                                 |
|------------|-------------------------------------------------------------|------------------------------------------|
| **1 credit**  | Simple, read-only, no external calls                     | Echo, format text, calculate, lookup     |
| **3 credits** | External API call, moderate complexity                   | Fetch weather, search database, send SMS |
| **10 credits**| AI model call, heavy compute, multi-step                 | Generate image, run LLM, complex analysis|

### Rules of thumb

- If it completes in under 1 second with no API calls -> 1 credit
- If it calls one external API -> 3 credits
- If it calls an AI model or does heavy processing -> 10 credits
- When in doubt, start with 3 credits and adjust based on feedback

---

## 9. Accessing Environment Variables

Tools can read secrets and configuration from environment variables:

```typescript
async execute(args) {
  const apiKey = process.env.MY_API_KEY;

  if (!apiKey) {
    throw new Error("MY_API_KEY environment variable is not set");
  }

  // Use apiKey in your API calls...
}
```

### Local development

1. Copy `.env.example` to `.env`
2. Fill in your values
3. The dev server loads `.env` automatically via tsx

### Production

Set environment variables in your hosting platform:

- **Netlify**: Site Settings > Environment Variables
- **Vercel**: Project Settings > Environment Variables

Never commit `.env` files to version control. The `.env.example` file
documents which variables are needed without exposing actual values.

---

## 10. Running the Dev Server

```bash
npm install      # Install dependencies (first time only)
npm run dev      # Start the Express dev server on port 3000
```

The server exposes:

| Endpoint     | Method | Purpose                          |
|-------------|--------|----------------------------------|
| `/`          | GET    | Health check / server info       |
| `/mcp`       | POST   | MCP JSON-RPC endpoint            |

### Manual testing with curl

List all tools:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Call a tool:

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"echo","arguments":{"message":"hello"}}}'
```

Initialize (handshake):

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"initialize"}'
```

Ping (health check):

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"ping"}'
```

---

## 11. Testing Your Tools

The test harness exercises all registered tools automatically:

```bash
npm run test
```

This will:

1. Call `initialize` and verify the handshake
2. Call `ping` and verify connectivity
3. Call `tools/list` and verify every tool has name, description, schema
4. Call each tool with sample arguments (from the SAMPLE_ARGS map)
5. Test error handling for unknown tools and invalid arguments

### Adding test cases for your tools

Open `scripts/test.ts` and add entries to the `SAMPLE_ARGS` map:

```typescript
const SAMPLE_ARGS: Record<string, Record<string, unknown>> = {
  echo: { message: "Hello from the test harness!" },
  random_number: { min: 1, max: 100 },
  // Add your tools here:
  get_weather: { city: "San Francisco" },
  translate: { text: "Hello", targetLanguage: "es" },
};
```

The test harness will automatically pick up and test any tool that has an
entry in this map.

---

## 12. Generating and Validating Config

The `mcpx.config.json` file tells the MCPX platform about your server and
its tools. Keep it in sync with your code:

### Generate

```bash
npm run generate-config
```

This reads the tool registry and writes the current tool metadata into
`mcpx.config.json`. It preserves your namespace, name, description, and
other top-level fields.

### Validate

```bash
npm run validate
```

This checks `mcpx.config.json` against the same validation rules the MCPX
platform uses when you publish. Fix any errors before deploying.

### Config fields

| Field            | Description                                      |
|------------------|--------------------------------------------------|
| `namespace`      | Unique lowercase identifier (3-30 chars, a-z0-9-)|
| `name`           | Human-readable server name (3-50 chars)          |
| `description`    | What the server does (10-200 chars)              |
| `category`       | One of: intelligence, analytics, productivity,   |
|                  | devtools, data, communication, marketing, other  |
| `tags`           | 1-10 lowercase tags for discovery                |
| `triggerPhrases` | 1-20 phrases that trigger server selection       |
| `endpointUrl`    | Public URL of your deployed MCP endpoint         |
| `tools`          | Array of tool metadata (auto-generated)          |

---

## 13. Deploying to Netlify

### Prerequisites

- A Netlify account
- The Netlify CLI (`npm i -g netlify-cli`)

### Steps

1. **Build the project:**

   ```bash
   npm run build
   ```

2. **Initialize Netlify (first time):**

   ```bash
   netlify init
   ```

3. **Set environment variables:**

   ```bash
   netlify env:set MY_API_KEY "your-key-here"
   ```

4. **Deploy:**

   ```bash
   netlify deploy --prod
   ```

5. **Update mcpx.config.json** with your Netlify URL:

   ```json
   {
     "endpointUrl": "https://your-site.netlify.app/mcp"
   }
   ```

### How it works

The `netlify.toml` file configures:
- Build command: `npm run build`
- Functions directory: `dist/src/adapters`
- A redirect from `/mcp` to the Netlify Function

The adapter at `src/adapters/netlify.ts` converts Netlify's event format to
the MCP handler's expected input.

---

## 14. Deploying to Vercel

### Prerequisites

- A Vercel account
- The Vercel CLI (`npm i -g vercel`)

### Steps

1. **Create an api directory and symlink the adapter:**

   ```bash
   mkdir -p api
   cp src/adapters/vercel.ts api/mcp.ts
   ```

   Or configure your build to output to the right location.

2. **Initialize Vercel (first time):**

   ```bash
   vercel
   ```

3. **Set environment variables:**

   ```bash
   vercel env add MY_API_KEY
   ```

4. **Deploy:**

   ```bash
   vercel --prod
   ```

5. **Update mcpx.config.json** with your Vercel URL:

   ```json
   {
     "endpointUrl": "https://your-project.vercel.app/mcp"
   }
   ```

### How it works

The `vercel.json` file configures:
- A rewrite from `/mcp` to `/api/mcp`
- The Node.js runtime for serverless functions

The adapter at `src/adapters/vercel.ts` converts Vercel's req/res format to
the MCP handler's expected input.

---

## 15. Publishing on MCPX

Once your server is deployed and working:

1. **Validate your config:**

   ```bash
   npm run validate
   ```

2. **Go to the MCPX Developer Portal:**

   Visit https://mcpx.gg/developer and sign in.

3. **Create a new server listing:**

   Upload or paste your `mcpx.config.json`.

4. **Submit for review:**

   The MCPX team reviews your server for quality and safety. This
   typically takes 1-2 business days.

5. **Go live:**

   Once approved, your server appears in the MCPX marketplace. Users
   can discover and use your tools through any connected AI assistant.

### Tips for a successful review

- Write clear, accurate tool descriptions
- Use appropriate credit costs
- Handle errors gracefully (throw Errors, do not return error strings)
- Set reasonable timeouts
- Document required environment variables in .env.example
- Test thoroughly with `npm run test`

---

## 16. Error Handling

### Inside tools

Always throw an Error when something goes wrong:

```typescript
async execute(args) {
  const response = await fetch("https://api.example.com/data");

  if (!response.ok) {
    throw new Error(`API returned HTTP ${response.status}`);
  }

  const data = await response.json();
  return JSON.stringify(data);
}
```

The MCP handler catches thrown errors and returns them as MCP error
responses with `isError: true`.

### Common error patterns

```typescript
// Missing environment variable
const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("API_KEY environment variable is not set");
}

// Invalid input (beyond schema validation)
if (args.startDate > args.endDate) {
  throw new Error("startDate must be before endDate");
}

// External API failure
const res = await fetch(url);
if (!res.ok) {
  const body = await res.text();
  throw new Error(`External API error (${res.status}): ${body}`);
}

// Timeout (handled automatically by the framework)
// Just set timeoutSeconds on the tool definition
```

---

## 17. Advanced Patterns

### Multiple tools per file

Group related tools in a single file:

```typescript
// src/tools/math.ts
import type { ToolDefinition } from "../lib/types.js";

const add: ToolDefinition = {
  name: "add",
  description: "Add two numbers",
  creditCost: 1,
  inputSchema: {
    type: "object",
    properties: {
      a: { type: "number" },
      b: { type: "number" },
    },
    required: ["a", "b"],
  },
  async execute(args) {
    return String((args.a as number) + (args.b as number));
  },
};

const multiply: ToolDefinition = {
  name: "multiply",
  description: "Multiply two numbers",
  creditCost: 1,
  inputSchema: {
    type: "object",
    properties: {
      a: { type: "number" },
      b: { type: "number" },
    },
    required: ["a", "b"],
  },
  async execute(args) {
    return String((args.a as number) * (args.b as number));
  },
};

export default [add, multiply] satisfies ToolDefinition[];
```

### Shared utilities

Create helper modules in `src/lib/` for code shared across tools:

```typescript
// src/lib/api-client.ts
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);
    if (response.ok || response.status < 500) return response;
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
}
```

### Returning structured data

Always return strings from execute(). For structured data, use
JSON.stringify:

```typescript
async execute(args) {
  const results = await searchDatabase(args.query as string);
  return JSON.stringify(results, null, 2);
}
```

The AI assistant will parse and interpret the JSON automatically.

---

## 18. Troubleshooting

### "Cannot find module" errors

Make sure all imports use `.js` extensions:

```typescript
// Correct
import type { ToolDefinition } from "../lib/types.js";

// Wrong - will fail with NodeNext resolution
import type { ToolDefinition } from "../lib/types";
```

### Tool not showing up in tools/list

1. Check that the file exports a default array of ToolDefinition
2. Check that you imported and registered it in `src/lib/tool-registry.ts`
3. Restart the dev server after making changes

### Validation errors

Run `npm run validate` to see detailed error messages. Common issues:
- Namespace contains uppercase letters or special characters
- Description is too short (minimum 10 characters)
- Credit cost is not 1, 3, or 10
- Tags contain uppercase letters

### Timeout errors

- Increase `timeoutSeconds` on the tool definition (max 60)
- Optimize external API calls
- Add caching for repeated lookups

### CORS errors in browser testing

The dev server and adapters include CORS headers by default. If you see
CORS errors, check that:
- The request is going to the correct URL
- The server is actually running
- No proxy is stripping headers

---

## 19. Full Example: Weather Tool

Here is a complete, production-ready weather tool:

```typescript
// src/tools/weather.ts
import type { ToolDefinition } from "../lib/types.js";

const getCurrentWeather: ToolDefinition = {
  name: "get_current_weather",
  description: "Get the current weather conditions for any city worldwide.",
  creditCost: 3,
  timeoutSeconds: 15,
  inputSchema: {
    type: "object",
    properties: {
      city: {
        type: "string",
        description: "City name (e.g. 'London', 'New York', 'Tokyo')",
        minLength: 1,
        maxLength: 100,
      },
      units: {
        type: "string",
        enum: ["celsius", "fahrenheit"],
        description: "Temperature units (default: celsius)",
      },
    },
    required: ["city"],
  },

  async execute(args) {
    const city = args.city as string;
    const units = (args.units as string) ?? "celsius";
    const apiKey = process.env.WEATHER_API_KEY;

    if (!apiKey) {
      throw new Error("WEATHER_API_KEY is not configured");
    }

    const url = new URL("https://api.weatherapi.com/v1/current.json");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("q", city);

    const response = await fetch(url.toString());

    if (!response.ok) {
      if (response.status === 400) {
        throw new Error(`City not found: ${city}`);
      }
      throw new Error(`Weather API error: HTTP ${response.status}`);
    }

    const data = await response.json() as {
      location: { name: string; country: string };
      current: {
        temp_c: number;
        temp_f: number;
        condition: { text: string };
        humidity: number;
        wind_kph: number;
      };
    };

    const temp = units === "fahrenheit"
      ? `${data.current.temp_f} F`
      : `${data.current.temp_c} C`;

    return JSON.stringify({
      city: data.location.name,
      country: data.location.country,
      temperature: temp,
      condition: data.current.condition.text,
      humidity: `${data.current.humidity}%`,
      wind: `${data.current.wind_kph} km/h`,
    });
  },
};

export default [getCurrentWeather] satisfies ToolDefinition[];
```

---

## 20. Full Example: Database Lookup Tool

Here is a tool that queries a PostgreSQL database:

```typescript
// src/tools/database.ts
import type { ToolDefinition } from "../lib/types.js";

const lookupUser: ToolDefinition = {
  name: "lookup_user",
  description: "Look up a user by email address in the database.",
  creditCost: 3,
  timeoutSeconds: 10,
  inputSchema: {
    type: "object",
    properties: {
      email: {
        type: "string",
        description: "The email address to search for",
        pattern: "^[^@]+@[^@]+\\.[^@]+$",
      },
    },
    required: ["email"],
  },

  async execute(args) {
    const email = args.email as string;
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
      throw new Error("DATABASE_URL is not configured");
    }

    // Example using a hypothetical DB client
    // Replace with your actual database library (pg, prisma, etc.)
    const response = await fetch(`${dbUrl}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
      headers: {
        "Authorization": `Bearer ${process.env.DB_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Database query failed: HTTP ${response.status}`);
    }

    const users = await response.json() as { id: string; name: string; email: string; created_at: string }[];

    if (users.length === 0) {
      return JSON.stringify({ found: false, message: `No user found with email: ${email}` });
    }

    const user = users[0];
    return JSON.stringify({
      found: true,
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.created_at,
    });
  },
};

export default [lookupUser] satisfies ToolDefinition[];
```

---

## Quick Reference Card

```
npm install              Install dependencies
npm run dev              Start dev server (port 3000)
npm run test             Run test harness
npm run build            Compile TypeScript to dist/
npm run generate-config  Regenerate mcpx.config.json
npm run validate         Validate mcpx.config.json

MCP endpoint:  POST /mcp
Health check:  GET  /

Credit costs:  1 = simple/read, 3 = API call, 10 = AI/heavy
Timeout:       default 30s, max 60s
```
