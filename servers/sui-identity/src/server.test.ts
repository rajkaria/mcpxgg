import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSuiIdentityServer } from './server.js';
import {
  createOfflineReputationStore,
  createOfflineSuiNsResolver,
  createOfflineZkLoginVerifier,
  hashSub,
  scoreFromReceipts,
} from './resolvers.js';

function rpc(
  server: ReturnType<typeof createSuiIdentityServer>,
  name: string,
  args: Record<string, unknown>,
) {
  return Promise.resolve(
    server.fetch(
      new Request('http://s/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name, arguments: args },
        }),
      }),
    ),
  ).then(
    (r) =>
      r.json() as Promise<{
        result: { content: Array<{ text: string }>; isError: boolean };
      }>,
  );
}

function body<T>(r: { result: { content: Array<{ text: string }> } }): T {
  return JSON.parse(r.result.content[0]!.text) as T;
}

const ADDR = '0x00000000000000000000000000000000000000000000000000000000000a11ce';

function makeServer() {
  return createSuiIdentityServer({
    suins: createOfflineSuiNsResolver(),
    zkLogin: createOfflineZkLoginVerifier(),
    reputation: createOfflineReputationStore({ [ADDR]: 1000, '0x0000000000000000000000000000000000000000000000000000000000000001': 5 }),
  });
}

const goodProof = {
  issuer: 'https://accounts.google.com',
  sub: 'subject-12345',
  aud: 'client-abc',
  proofPoints: { a: ['1'], b: [['2']], c: ['3'] },
  ephemeralPublicKey: 'ed25519:xyz',
};

test('manifest exposes all four tools with string bigint prices', () => {
  const m = makeServer().manifest();
  const names = m.tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    'address_reputation',
    'resolve_address',
    'resolve_name',
    'verify_zklogin',
  ]);
  assert.equal(m.tools.find((t) => t.name === 'verify_zklogin')?.priceAtomic, '5000');
  assert.equal(m.tools.find((t) => t.name === 'verify_zklogin')?.freeTierCallsPerUser, 1);
  assert.equal(m.tools.find((t) => t.name === 'resolve_address')?.priceAtomic, '1000');
  assert.equal(m.tools.find((t) => t.name === 'address_reputation')?.priceAtomic, '2000');
});

test('resolve_address: known SuiNS name → address', async () => {
  const r = body<{ name: string; address: string | null; resolved: boolean }>(
    await rpc(makeServer(), 'resolve_address', { name: 'alice.sui' }),
  );
  assert.equal(r.resolved, true);
  assert.equal(r.address, ADDR);
});

test('resolve_address: unknown name resolves to null (not an error)', async () => {
  const r = body<{ resolved: boolean; address: string | null }>(
    await rpc(makeServer(), 'resolve_address', { name: 'nobody.sui' }),
  );
  assert.equal(r.resolved, false);
  assert.equal(r.address, null);
});

test('resolve_address: malformed name is rejected', async () => {
  for (const bad of ['', 'no-tld', 'alice.eth', 'Alice Sui', '../x.sui']) {
    const r = await rpc(makeServer(), 'resolve_address', { name: bad });
    assert.equal(r.result.isError, true, `expected reject for ${JSON.stringify(bad)}`);
  }
});

test('resolve_name: address → primary SuiNS name (round-trips alice.sui)', async () => {
  const r = body<{ address: string; name: string | null; resolved: boolean }>(
    await rpc(makeServer(), 'resolve_name', { address: ADDR }),
  );
  assert.equal(r.resolved, true);
  assert.equal(r.name, 'alice.sui');
});

test('resolve_name: address with no name resolves to null', async () => {
  const r = body<{ resolved: boolean; name: string | null }>(
    await rpc(makeServer(), 'resolve_name', {
      address: '0x0000000000000000000000000000000000000000000000000000000000009999',
    }),
  );
  assert.equal(r.resolved, false);
  assert.equal(r.name, null);
});

test('resolve_name: malformed address is rejected', async () => {
  for (const bad of ['', 'alice.sui', '0xZZZZ', 'deadbeef', '0x' + 'f'.repeat(65)]) {
    const r = await rpc(makeServer(), 'resolve_name', { address: bad });
    assert.equal(r.result.isError, true, `expected reject for ${JSON.stringify(bad)}`);
  }
});

test('verify_zklogin: valid proof → valid:true, issuer, sub_hash, no raw sub', async () => {
  const r = await rpc(makeServer(), 'verify_zklogin', { proof: goodProof });
  const out = body<{ valid: boolean; issuer: string; sub_hash: string }>(r);
  assert.equal(out.valid, true);
  assert.equal(out.issuer, 'https://accounts.google.com');
  assert.equal(out.sub_hash, hashSub('https://accounts.google.com', 'subject-12345'));
  assert.ok(!r.result.content[0]!.text.includes('subject-12345'), 'raw sub never echoed');
});

test('verify_zklogin: unknown issuer is invalid', async () => {
  const out = body<{ valid: boolean; reason: string }>(
    await rpc(makeServer(), 'verify_zklogin', {
      proof: { ...goodProof, issuer: 'https://evil.example.com' },
    }),
  );
  assert.equal(out.valid, false);
  assert.match(out.reason, /unrecognised issuer/);
});

test('verify_zklogin: malformed proofPoints is invalid', async () => {
  const out = body<{ valid: boolean; reason: string }>(
    await rpc(makeServer(), 'verify_zklogin', {
      proof: { ...goodProof, proofPoints: { a: 'not-an-array' } },
    }),
  );
  assert.equal(out.valid, false);
  assert.match(out.reason, /malformed proofPoints/);
});

test('verify_zklogin: missing sub is invalid', async () => {
  const out = body<{ valid: boolean; reason: string }>(
    await rpc(makeServer(), 'verify_zklogin', {
      proof: { issuer: 'https://accounts.google.com', aud: 'x', proofPoints: goodProof.proofPoints },
    }),
  );
  assert.equal(out.valid, false);
  assert.match(out.reason, /missing issuer or sub/);
});

test('verify_zklogin: non-object proof is a tool error', async () => {
  const r = await rpc(makeServer(), 'verify_zklogin', { proof: 'a string' });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0]!.text, /proof must be an object/);
});

test('address_reputation: high receipt count → high score and tier', async () => {
  const out = body<{ receipt_count: number; score: number; tier: string; source: string }>(
    await rpc(makeServer(), 'address_reputation', { address: ADDR }),
  );
  assert.equal(out.receipt_count, 1000);
  assert.equal(out.source, 'indexer-mirror');
  assert.ok(out.score >= 80, `expected trusted score, got ${out.score}`);
  assert.equal(out.tier, 'trusted');
});

test('address_reputation: unknown address → empty reputation (score 0, unknown)', async () => {
  const out = body<{ receipt_count: number; score: number; tier: string }>(
    await rpc(makeServer(), 'address_reputation', {
      address: '0x0000000000000000000000000000000000000000000000000000000000007777',
    }),
  );
  assert.equal(out.receipt_count, 0);
  assert.equal(out.score, 0);
  assert.equal(out.tier, 'unknown');
});

test('address_reputation: malformed address is rejected', async () => {
  const r = await rpc(makeServer(), 'address_reputation', { address: 'not-an-address' });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0]!.text, /not a valid Sui address/);
});

test('scoreFromReceipts is monotonic and bounded 0..100', () => {
  assert.deepEqual(scoreFromReceipts(0), { score: 0, tier: 'unknown' });
  const a = scoreFromReceipts(10).score;
  const b = scoreFromReceipts(100).score;
  const c = scoreFromReceipts(100000).score;
  assert.ok(a < b && b <= c);
  assert.ok(c <= 100);
});

test('boots offline with zero config (default factory)', async () => {
  const s = createSuiIdentityServer();
  const r = body<{ resolved: boolean }>(
    await rpc(s, 'resolve_address', { name: 'mcpx.sui' }),
  );
  assert.equal(r.resolved, true);
});
