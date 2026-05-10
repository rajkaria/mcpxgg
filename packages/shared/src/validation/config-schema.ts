/**
 * mcpx.config.json validation. Replaces the legacy `creditCost: 1 | 3 | 10`
 * pricing with `priceAtomic: bigint` (USDsui smallest units) per S1-T20.
 *
 * Wire format: priceAtomic in JSON is a string-encoded integer (so JSON
 * doesn't lose precision past 2^53). We accept either a number ≤ 2^53 OR a
 * decimal string. SDKs writing this file MUST string-encode for amounts
 * above 9,007,199,254,740,991 atomic units.
 */

const VALID_CATEGORIES = [
  'intelligence',
  'analytics',
  'productivity',
  'devtools',
  'data',
  'communication',
  'marketing',
  'other',
] as const;

const MAX_SAFE_INT = BigInt(Number.MAX_SAFE_INTEGER);
const ABSOLUTE_MAX_PRICE_ATOMIC = (1n << 63n) - 1n;

export interface ToolConfig {
  name: string;
  description: string;
  /** Per-call price in USDsui smallest units (6 decimals). E.g. 50_000n = $0.05 */
  priceAtomic: bigint;
  /** Free-tier calls per user before billing kicks in. 0 = no free tier. */
  freeTierCallsPerUser: number;
  timeoutSeconds: number;
  inputSchema: Record<string, unknown>;
}

export interface McpxConfig {
  namespace: string;
  name: string;
  description: string;
  category: (typeof VALID_CATEGORIES)[number];
  tags: string[];
  triggerPhrases: string[];
  tools: ToolConfig[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function parsePriceAtomic(raw: unknown, ctx: string): { value: bigint | null; error?: string } {
  if (typeof raw === 'bigint') {
    return validatePriceRange(raw, ctx);
  }
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw)) return { value: null, error: `${ctx}.priceAtomic must be an integer` };
    if (raw < 0) return { value: null, error: `${ctx}.priceAtomic must be ≥ 0` };
    if (raw > Number.MAX_SAFE_INTEGER) {
      return {
        value: null,
        error: `${ctx}.priceAtomic above 2^53 must be encoded as a string`,
      };
    }
    return validatePriceRange(BigInt(raw), ctx);
  }
  if (typeof raw === 'string') {
    if (!/^[0-9]+$/.test(raw)) {
      return { value: null, error: `${ctx}.priceAtomic string must be a non-negative integer` };
    }
    try {
      return validatePriceRange(BigInt(raw), ctx);
    } catch {
      return { value: null, error: `${ctx}.priceAtomic could not parse as bigint` };
    }
  }
  return {
    value: null,
    error: `${ctx}.priceAtomic must be a bigint, number, or decimal string`,
  };
}

function validatePriceRange(v: bigint, ctx: string): { value: bigint | null; error?: string } {
  if (v < 0n) return { value: null, error: `${ctx}.priceAtomic must be ≥ 0` };
  if (v > ABSOLUTE_MAX_PRICE_ATOMIC) {
    return { value: null, error: `${ctx}.priceAtomic exceeds u64 max` };
  }
  return { value: v };
}

export function validateConfig(config: unknown): ValidationResult {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Config must be a non-null object'] };
  }

  const c = config as Record<string, unknown>;

  // namespace
  if (typeof c.namespace !== 'string') {
    errors.push('namespace must be a string');
  } else {
    if (c.namespace.length < 3 || c.namespace.length > 64) {
      errors.push('namespace must be between 3 and 64 characters');
    }
    if (!/^[a-z0-9_-]+$/.test(c.namespace)) {
      errors.push('namespace must be lowercase a-z 0-9 with - and _ only');
    }
    if (c.namespace.startsWith('-') || c.namespace.endsWith('-')) {
      errors.push('namespace cannot start or end with a hyphen');
    }
  }

  // name
  if (typeof c.name !== 'string') {
    errors.push('name must be a string');
  } else if (c.name.length < 3 || c.name.length > 50) {
    errors.push('name must be between 3 and 50 characters');
  }

  // description
  if (typeof c.description !== 'string') {
    errors.push('description must be a string');
  } else if (c.description.length < 10 || c.description.length > 200) {
    errors.push('description must be between 10 and 200 characters');
  }

  // category
  if (typeof c.category !== 'string') {
    errors.push('category must be a string');
  } else if (!(VALID_CATEGORIES as readonly string[]).includes(c.category)) {
    errors.push(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  // tags
  if (!Array.isArray(c.tags)) {
    errors.push('tags must be an array');
  } else {
    if (c.tags.length < 1 || c.tags.length > 10) {
      errors.push('tags must have between 1 and 10 entries');
    }
    for (const tag of c.tags) {
      if (typeof tag !== 'string') {
        errors.push('each tag must be a string');
        break;
      }
      if (tag !== tag.toLowerCase()) {
        errors.push(`tag "${tag}" must be lowercase`);
      }
    }
  }

  // triggerPhrases
  if (!Array.isArray(c.triggerPhrases)) {
    errors.push('triggerPhrases must be an array');
  } else {
    if (c.triggerPhrases.length < 1 || c.triggerPhrases.length > 20) {
      errors.push('triggerPhrases must have between 1 and 20 entries');
    }
    for (const phrase of c.triggerPhrases) {
      if (typeof phrase !== 'string') {
        errors.push('each triggerPhrase must be a string');
        break;
      }
    }
  }

  // tools
  if (!Array.isArray(c.tools)) {
    errors.push('tools must be an array');
  } else {
    if (c.tools.length < 1) {
      errors.push('tools must have at least one entry');
    }
    if (c.tools.length > 100) {
      errors.push('tools must have at most 100 entries (matches contracts MAX_TOOLS_PER_SERVER)');
    }
    for (let i = 0; i < c.tools.length; i++) {
      const tool = c.tools[i] as Record<string, unknown>;
      const prefix = `tools[${i}]`;

      if (!tool || typeof tool !== 'object') {
        errors.push(`${prefix} must be an object`);
        continue;
      }

      if (typeof tool.name !== 'string' || tool.name.length === 0) {
        errors.push(`${prefix}.name must be a non-empty string`);
      } else if (tool.name.length > 64) {
        errors.push(`${prefix}.name must be at most 64 characters`);
      }

      if (typeof tool.description !== 'string' || tool.description.length === 0) {
        errors.push(`${prefix}.description must be a non-empty string`);
      }

      const priceCheck = parsePriceAtomic(tool.priceAtomic, prefix);
      if (priceCheck.error) errors.push(priceCheck.error);

      if (
        typeof tool.freeTierCallsPerUser !== 'number' ||
        !Number.isInteger(tool.freeTierCallsPerUser) ||
        tool.freeTierCallsPerUser < 0
      ) {
        errors.push(`${prefix}.freeTierCallsPerUser must be a non-negative integer`);
      }

      if (
        typeof tool.timeoutSeconds !== 'number' ||
        !Number.isInteger(tool.timeoutSeconds) ||
        tool.timeoutSeconds < 1 ||
        tool.timeoutSeconds > 600
      ) {
        errors.push(`${prefix}.timeoutSeconds must be an integer between 1 and 600`);
      }

      if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
        errors.push(`${prefix}.inputSchema must be an object`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export const VALIDATION_CONSTANTS = {
  VALID_CATEGORIES,
  MAX_SAFE_INT,
  ABSOLUTE_MAX_PRICE_ATOMIC,
} as const;
