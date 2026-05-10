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

const VALID_CREDIT_COSTS = [1, 3, 10] as const;

interface ToolConfig {
  name: string;
  description: string;
  creditCost: number;
  timeoutSeconds: number;
  inputSchema: Record<string, unknown>;
}

interface McpxConfig {
  namespace: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  triggerPhrases: string[];
  tools: ToolConfig[];
}

export function validateConfig(config: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Config must be a non-null object'] };
  }

  const c = config as Record<string, unknown>;

  // Validate namespace
  if (typeof c.namespace !== 'string') {
    errors.push('namespace must be a string');
  } else {
    if (c.namespace.length < 3 || c.namespace.length > 30) {
      errors.push('namespace must be between 3 and 30 characters');
    }
    if (!/^[a-z0-9-]+$/.test(c.namespace)) {
      errors.push('namespace must be lowercase alphanumeric with hyphens only');
    }
    if (c.namespace.startsWith('-') || c.namespace.endsWith('-')) {
      errors.push('namespace cannot start or end with a hyphen');
    }
  }

  // Validate name
  if (typeof c.name !== 'string') {
    errors.push('name must be a string');
  } else if (c.name.length < 3 || c.name.length > 50) {
    errors.push('name must be between 3 and 50 characters');
  }

  // Validate description
  if (typeof c.description !== 'string') {
    errors.push('description must be a string');
  } else if (c.description.length < 10 || c.description.length > 200) {
    errors.push('description must be between 10 and 200 characters');
  }

  // Validate category
  if (typeof c.category !== 'string') {
    errors.push('category must be a string');
  } else if (!(VALID_CATEGORIES as readonly string[]).includes(c.category)) {
    errors.push(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  // Validate tags
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

  // Validate triggerPhrases
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

  // Validate tools
  if (!Array.isArray(c.tools)) {
    errors.push('tools must be an array');
  } else {
    if (c.tools.length < 1) {
      errors.push('tools must have at least one entry');
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
      }

      if (typeof tool.description !== 'string' || tool.description.length === 0) {
        errors.push(`${prefix}.description must be a non-empty string`);
      }

      if (typeof tool.creditCost !== 'number' || !(VALID_CREDIT_COSTS as readonly number[]).includes(tool.creditCost)) {
        errors.push(`${prefix}.creditCost must be one of: ${VALID_CREDIT_COSTS.join(', ')}`);
      }

      if (typeof tool.timeoutSeconds !== 'number' || tool.timeoutSeconds < 1 || tool.timeoutSeconds > 60) {
        errors.push(`${prefix}.timeoutSeconds must be between 1 and 60`);
      }

      if (!tool.inputSchema || typeof tool.inputSchema !== 'object') {
        errors.push(`${prefix}.inputSchema must be an object`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export type { McpxConfig, ToolConfig };
