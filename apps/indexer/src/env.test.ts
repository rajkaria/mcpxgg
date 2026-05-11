import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { loadEnv } from './env.js';

describe('indexer loadEnv', () => {
  it('returns defaults in test mode', () => {
    const env = loadEnv({ MCPX_INDEXER_TEST_MODE: '1' });
    assert.equal(env.testMode, true);
    assert.equal(env.network, 'sui-testnet');
    assert.equal(env.pollIntervalMs, 1000);
    assert.equal(env.pageSize, 50);
  });

  it('rejects bad network', () => {
    assert.throws(
      () => loadEnv({ MCPX_INDEXER_TEST_MODE: '1', SUI_NETWORK: 'eth' }),
      /SUI_NETWORK/,
    );
  });

  it('requires real env in prod mode', () => {
    assert.throws(() => loadEnv({}), /MCPX_PACKAGE_ID/);
  });

  it('loads full prod env', () => {
    const env = loadEnv({
      MCPX_PACKAGE_ID: '0xpkg',
      SUPABASE_URL: 'https://abc.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'srk',
      SUI_NETWORK: 'sui-mainnet',
    });
    assert.equal(env.testMode, false);
    assert.equal(env.mcpxPackageId, '0xpkg');
    assert.equal(env.supabaseUrl, 'https://abc.supabase.co');
  });
});
