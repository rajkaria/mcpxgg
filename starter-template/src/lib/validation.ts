// ---------------------------------------------------------------------------
// MCPX Starter Template - Input Validation
// ---------------------------------------------------------------------------
// Uses Zod to validate arbitrary JSON payloads against a JSON Schema-style
// definition.  This keeps tool authors from having to write manual checks.
// ---------------------------------------------------------------------------

import { z, ZodTypeAny } from "zod";
import type { JsonSchema } from "./types.js";

/**
 * Convert a simplified JSON Schema `properties` block into a Zod schema.
 *
 * Supports the types most commonly used in MCP tool definitions:
 *   string, number, integer, boolean, array, object
 *
 * Any unrecognised type falls back to `z.unknown()`.
 */
function jsonSchemaPropertyToZod(prop: Record<string, unknown>): ZodTypeAny {
  const type = prop.type as string | undefined;

  switch (type) {
    case "string": {
      let schema = z.string();
      if (typeof prop.minLength === "number") schema = schema.min(prop.minLength);
      if (typeof prop.maxLength === "number") schema = schema.max(prop.maxLength);
      if (typeof prop.pattern === "string") schema = schema.regex(new RegExp(prop.pattern));
      if (typeof prop.enum !== "undefined" && Array.isArray(prop.enum)) {
        return z.enum(prop.enum as [string, ...string[]]);
      }
      return schema;
    }
    case "number":
    case "integer": {
      let schema = z.number();
      if (type === "integer") schema = schema.int();
      if (typeof prop.minimum === "number") schema = schema.min(prop.minimum);
      if (typeof prop.maximum === "number") schema = schema.max(prop.maximum);
      return schema;
    }
    case "boolean":
      return z.boolean();
    case "array":
      return z.array(z.unknown());
    case "object":
      return z.record(z.unknown());
    default:
      return z.unknown();
  }
}

/**
 * Build a Zod object schema from a JSON Schema definition.
 *
 * Expects the top-level schema to have `properties` and optionally `required`.
 */
function buildZodSchema(schema: JsonSchema): z.ZodObject<Record<string, ZodTypeAny>> {
  const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = (schema.required ?? []) as string[];

  const shape: Record<string, ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(properties)) {
    let fieldSchema = jsonSchemaPropertyToZod(prop);
    if (!required.includes(key)) {
      fieldSchema = fieldSchema.optional() as unknown as ZodTypeAny;
    }
    shape[key] = fieldSchema;
  }

  return z.object(shape);
}

/**
 * Validate an unknown input payload against a JSON Schema definition.
 *
 * @param schema - The JSON Schema describing the expected input shape.
 * @param args   - The raw input to validate.
 * @returns An object with `valid: true` on success, or `valid: false` with
 *          a list of human-readable `errors`.
 */
export function validateInput(
  schema: JsonSchema,
  args: unknown,
): { valid: boolean; errors?: string[] } {
  try {
    const zodSchema = buildZodSchema(schema);
    zodSchema.parse(args);
    return { valid: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const errors = err.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`,
      );
      return { valid: false, errors };
    }
    return { valid: false, errors: ["Unknown validation error"] };
  }
}
