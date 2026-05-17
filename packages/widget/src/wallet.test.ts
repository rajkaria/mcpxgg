import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveWallet, isLikelySessionKey } from './wallet.js';

test('host hook wins and yields a key', async () => {
  const r = await resolveWallet({
    mcpx: { getSessionKey: () => 'mcpx_sk_fromhook' },
  });
  assert.equal(r.kind, 'host-hook');
  assert.equal(r.apiKey, 'mcpx_sk_fromhook');
  assert.equal(r.needsKey, false);
});

test('privy direct key', async () => {
  const r = await resolveWallet({ privy: { mcpxSessionKey: 'mcpx_sk_p' } });
  assert.equal(r.kind, 'privy');
  assert.equal(r.apiKey, 'mcpx_sk_p');
  assert.equal(r.needsKey, false);
});

test('privy present without key still flags privy + needsKey', async () => {
  const r = await resolveWallet({ privy: {} });
  assert.equal(r.kind, 'privy');
  assert.equal(r.needsKey, true);
});

test('bare sui wallet fallback', async () => {
  const r = await resolveWallet({ suiWallet: {} });
  assert.equal(r.kind, 'sui-wallet');
  assert.equal(r.needsKey, true);
});

test('no integration → manual paste path', async () => {
  const r = await resolveWallet({});
  assert.equal(r.kind, 'manual');
  assert.equal(r.needsKey, true);
});

test('host hook failure falls through to next strategy', async () => {
  const r = await resolveWallet({
    mcpx: {
      getSessionKey: () => {
        throw new Error('boom');
      },
    },
    privy: { mcpxSessionKey: 'mcpx_sk_recovered' },
  });
  assert.equal(r.kind, 'privy');
  assert.equal(r.apiKey, 'mcpx_sk_recovered');
});

test('isLikelySessionKey shape check', () => {
  assert.equal(isLikelySessionKey('mcpx_sk_abcdefgh'), true);
  assert.equal(isLikelySessionKey('  mcpx_sk_abcdefgh  '), true);
  assert.equal(isLikelySessionKey('nope'), false);
  assert.equal(isLikelySessionKey('mcpx_sk_'), false);
});
