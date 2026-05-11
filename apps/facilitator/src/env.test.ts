import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('returns defaults in test mode', () => {
    const env = loadEnv({ MCPX_FACILITATOR_TEST_MODE: '1' });
    assert.equal(env.testMode, true);
    assert.equal(env.network, 'sui-testnet');
    assert.equal(env.port, 3002);
  });

  it('throws on missing required env in prod mode', () => {
    assert.throws(() => loadEnv({}), /MCPX_PACKAGE_ID/);
  });

  it('throws on invalid SUI_NETWORK', () => {
    assert.throws(
      () => loadEnv({ MCPX_FACILITATOR_TEST_MODE: '1', SUI_NETWORK: 'eth-mainnet' }),
      /SUI_NETWORK/,
    );
  });

  it('throws on bad port', () => {
    assert.throws(
      () => loadEnv({ MCPX_FACILITATOR_TEST_MODE: '1', PORT: 'abc' }),
      /PORT/,
    );
  });

  it('accepts all required vars in prod mode', () => {
    const env = loadEnv({
      MCPX_PACKAGE_ID: '0x1',
      MCPX_PLATFORM_CONFIG_ID: '0x2',
      MCPX_TREASURY_ID: '0x3',
      MCPX_INSURANCE_ID: '0x4',
      MCPX_REGISTRY_ID: '0x5',
      USDSUI_COIN_TYPE: '0x6::u::U',
      GAS_STATION_KEY: 'suiprivkey',
      SUI_NETWORK: 'sui-mainnet',
    });
    assert.equal(env.testMode, false);
    assert.equal(env.network, 'sui-mainnet');
    assert.equal(env.mcpxPackageId, '0x1');
  });
});
