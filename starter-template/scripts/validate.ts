// ---------------------------------------------------------------------------
// MCPX Starter Template - Config Validator
// ---------------------------------------------------------------------------
// Validates mcpx.config.json against the MCPX platform's config schema.
//
// The validation logic mirrors what the MCPX platform uses when you publish
// a server, so running this locally catches errors before you submit.
//
// Usage:  npm run validate
// ---------------------------------------------------------------------------

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.resolve(__dirname, "..", "mcpx.config.json");

// ---------------------------------------------------------------------------
// Inline validation logic
// ---------------------------------------------------------------------------
// We inline the validation rules here so the starter template remains
// self-contained and does not import from the parent MCPX monorepo.
// These rules match lib/validation/config-schema.ts in the MCPX platform.
// ---------------------------------------------------------------------------

const VALID_CATEGORIES = [
  "intelligence",
  "analytics",
  "productivity",
  "devtools",
  "data",
  "communication",
  "marketing",
  "other",
] as const;

const VALID_CREDIT_COSTS = [1, 3, 10] as const;

function validateConfig(config: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config || typeof config !== "object") {
    return { valid: false, errors: ["Config must be a non-null object"] };
  }

  const c = config as Record<string, unknown>;

  // Validate namespace
  if (typeof c.namespace !== "string") {
    errors.push("namespace must be a string");
  } else {
    if (c.namespace.length < 3 || c.namespace.length > 30) {
      errors.push("namespace must be between 3 and 30 characters");
    }
    if (!/^[a-z0-9-]+$/.test(c.namespace)) {
      errors.push("namespace must be lowercase alphanumeric with hyphens only");
    }
    if (c.namespace.startsWith("-") || c.namespace.endsWith("-")) {
      errors.push("namespace cannot start or end with a hyphen");
    }
  }

  // Validate name
  if (typeof c.name !== "string") {
    errors.push("name must be a string");
  } else if (c.name.length < 3 || c.name.length > 50) {
    errors.push("name must be between 3 and 50 characters");
  }

  // Validate description
  if (typeof c.description !== "string") {
    errors.push("description must be a string");
  } else if (c.description.length < 10 || c.description.length > 200) {
    errors.push("description must be between 10 and 200 characters");
  }

  // Validate category
  if (typeof c.category !== "string") {
    errors.push("category must be a string");
  } else if (!(VALID_CATEGORIES as readonly string[]).includes(c.category)) {
    errors.push(`category must be one of: ${VALID_CATEGORIES.join(", ")}`);
  }

  // Validate tags
  if (!Array.isArray(c.tags)) {
    errors.push("tags must be an array");
  } else {
    if (c.tags.length < 1 || c.tags.length > 10) {
      errors.push("tags must have between 1 and 10 entries");
    }
    for (const tag of c.tags) {
      if (typeof tag !== "string") {
        errors.push("each tag must be a string");
        break;
      }
      if (tag !== tag.toLowerCase()) {
        errors.push(`tag "${tag}" must be lowercase`);
      }
    }
  }

  // Validate triggerPhrases
  if (!Array.isArray(c.triggerPhrases)) {
    errors.push("triggerPhrases must be an array");
  } else {
    if (c.triggerPhrases.length < 1 || c.triggerPhrases.length > 20) {
      errors.push("triggerPhrases must have between 1 and 20 entries");
    }
    for (const phrase of c.triggerPhrases) {
      if (typeof phrase !== "string") {
        errors.push("each triggerPhrase must be a string");
        break;
      }
    }
  }

  // Validate endpointUrl (optional but recommended)
  if (c.endpointUrl !== undefined) {
    if (typeof c.endpointUrl !== "string") {
      errors.push("endpointUrl must be a string");
    } else {
      try {
        new URL(c.endpointUrl);
      } catch {
        errors.push("endpointUrl must be a valid URL");
      }
    }
  }

  // Validate tools
  if (!Array.isArray(c.tools)) {
    errors.push("tools must be an array");
  } else {
    if (c.tools.length < 1) {
      errors.push("tools must have at least one entry");
    }
    for (let i = 0; i < c.tools.length; i++) {
      const tool = c.tools[i] as Record<string, unknown>;
      const prefix = `tools[${i}]`;

      if (!tool || typeof tool !== "object") {
        errors.push(`${prefix} must be an object`);
        continue;
      }

      if (typeof tool.name !== "string" || tool.name.length === 0) {
        errors.push(`${prefix}.name must be a non-empty string`);
      }

      if (typeof tool.description !== "string" || tool.description.length === 0) {
        errors.push(`${prefix}.description must be a non-empty string`);
      }

      if (
        typeof tool.creditCost !== "number" ||
        !(VALID_CREDIT_COSTS as readonly number[]).includes(tool.creditCost)
      ) {
        errors.push(`${prefix}.creditCost must be one of: ${VALID_CREDIT_COSTS.join(", ")}`);
      }

      if (tool.timeoutSeconds !== undefined) {
        if (typeof tool.timeoutSeconds !== "number" || tool.timeoutSeconds < 1 || tool.timeoutSeconds > 60) {
          errors.push(`${prefix}.timeoutSeconds must be between 1 and 60`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log("==============================================");
  console.log("  MCPX Config Validator");
  console.log("==============================================\n");

  if (!fs.existsSync(CONFIG_PATH)) {
    console.error("  ERROR: mcpx.config.json not found.");
    console.error("  Run `npm run generate-config` first.\n");
    process.exit(1);
  }

  let config: unknown;
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    config = JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`  ERROR: Failed to parse mcpx.config.json: ${message}\n`);
    process.exit(1);
  }

  const result = validateConfig(config);

  if (result.valid) {
    console.log("  Config is valid!\n");
    const c = config as Record<string, unknown>;
    console.log(`  Namespace:   ${c.namespace}`);
    console.log(`  Name:        ${c.name}`);
    console.log(`  Category:    ${c.category}`);
    console.log(`  Tools:       ${(c.tools as unknown[]).length}`);
    console.log(`  Endpoint:    ${c.endpointUrl ?? "(not set)"}`);
    console.log();
  } else {
    console.error(`  Found ${result.errors.length} error(s):\n`);
    for (const error of result.errors) {
      console.error(`    - ${error}`);
    }
    console.error();
    process.exit(1);
  }
}

main();
