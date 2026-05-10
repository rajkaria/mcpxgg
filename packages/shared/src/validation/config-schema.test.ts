/**
 * Vitest-style tests using Node's built-in test runner. Run via:
 *   pnpm --filter @mcpxgg/shared test
 *
 * Covers the priceAtomic replacement of credit_cost (S1-T20) and
 * the broader validateConfig contract.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from './config-schema';

const baseConfig = {
  namespace: 'test-server',
  name: 'Test Server',
  description: 'A description that fits the length requirement.',
  category: 'devtools',
  tags: ['testing'],
  triggerPhrases: ['use the test server'],
  tools: [
    {
      name: 'query',
      description: 'A test tool',
      priceAtomic: 50_000,
      freeTierCallsPerUser: 0,
      timeoutSeconds: 30,
      inputSchema: { type: 'object' },
    },
  ],
};

describe('validateConfig — priceAtomic replaces credit_cost', () => {
  it('accepts a valid config with number priceAtomic', () => {
    const result = validateConfig(baseConfig);
    assert.equal(result.valid, true, result.errors.join('; '));
  });

  it('accepts string-encoded priceAtomic', () => {
    const cfg = structuredClone(baseConfig);
    cfg.tools[0]!.priceAtomic = '50000' as unknown as number;
    const result = validateConfig(cfg);
    assert.equal(result.valid, true, result.errors.join('; '));
  });

  it('accepts bigint priceAtomic', () => {
    const cfg = structuredClone(baseConfig) as Record<string, unknown> & {
      tools: Array<Record<string, unknown>>;
    };
    cfg.tools[0]!.priceAtomic = 50_000n;
    const result = validateConfig(cfg);
    assert.equal(result.valid, true, result.errors.join('; '));
  });

  it('rejects negative priceAtomic', () => {
    const cfg = structuredClone(baseConfig);
    cfg.tools[0]!.priceAtomic = -1;
    const result = validateConfig(cfg);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => /priceAtomic/.test(e)));
  });

  it('rejects non-integer priceAtomic', () => {
    const cfg = structuredClone(baseConfig);
    cfg.tools[0]!.priceAtomic = 1.5;
    const result = validateConfig(cfg);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => /integer/.test(e)));
  });

  it('rejects priceAtomic above 2^53 as number', () => {
    const cfg = structuredClone(baseConfig);
    cfg.tools[0]!.priceAtomic = Number.MAX_SAFE_INTEGER + 1; // becomes 2^53 due to float
    cfg.tools[0]!.priceAtomic = 9_007_199_254_740_993; // representation issue, but > MAX_SAFE
    const result = validateConfig(cfg);
    assert.equal(result.valid, false);
  });

  it('rejects bare creditCost (legacy field)', () => {
    // Legacy field should fail because there's no priceAtomic
    const cfg = {
      ...baseConfig,
      tools: [
        {
          ...baseConfig.tools[0]!,
          creditCost: 1,
          priceAtomic: undefined,
        },
      ],
    };
    const result = validateConfig(cfg);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => /priceAtomic/.test(e)));
  });

  it('rejects negative freeTierCallsPerUser', () => {
    const cfg = structuredClone(baseConfig);
    cfg.tools[0]!.freeTierCallsPerUser = -1;
    const result = validateConfig(cfg);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => /freeTierCallsPerUser/.test(e)));
  });

  it('rejects timeoutSeconds outside 1..600', () => {
    const cfg = structuredClone(baseConfig);
    cfg.tools[0]!.timeoutSeconds = 0;
    let result = validateConfig(cfg);
    assert.equal(result.valid, false);
    cfg.tools[0]!.timeoutSeconds = 601;
    result = validateConfig(cfg);
    assert.equal(result.valid, false);
  });
});

describe('validateConfig — namespace rules', () => {
  it('accepts hyphen and underscore', () => {
    const cfg = structuredClone(baseConfig);
    cfg.namespace = 'my_server-v2';
    const result = validateConfig(cfg);
    assert.equal(result.valid, true, result.errors.join('; '));
  });

  it('rejects uppercase', () => {
    const cfg = structuredClone(baseConfig);
    cfg.namespace = 'MyServer';
    const result = validateConfig(cfg);
    assert.equal(result.valid, false);
  });

  it('rejects leading hyphen', () => {
    const cfg = structuredClone(baseConfig);
    cfg.namespace = '-leading';
    const result = validateConfig(cfg);
    assert.equal(result.valid, false);
  });

  it('rejects too-long namespace', () => {
    const cfg = structuredClone(baseConfig);
    cfg.namespace = 'a'.repeat(65);
    const result = validateConfig(cfg);
    assert.equal(result.valid, false);
  });
});

describe('validateConfig — non-object inputs', () => {
  it('rejects null', () => {
    assert.equal(validateConfig(null).valid, false);
  });
  it('rejects array', () => {
    assert.equal(validateConfig([]).valid, false);
  });
  it('rejects empty tool list', () => {
    const cfg = { ...baseConfig, tools: [] };
    const result = validateConfig(cfg);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => /at least one/.test(e)));
  });
});
