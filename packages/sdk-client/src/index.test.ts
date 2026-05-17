import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMCPXClient, MCPXError } from './index.js';

interface Capture {
  url: string;
  headers: Record<string, string>;
  body: { method: string; params: { name: string; arguments: unknown } };
}

function stubFetch(
  capture: Capture[],
  respond: () => unknown,
): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => {
      headers[k] = v;
    });
    capture.push({
      url: String(input),
      headers,
      body: JSON.parse(String(init?.body)) as Capture['body'],
    });
    return new Response(JSON.stringify(respond()), {
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

const RECEIPT = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    content: [{ type: 'text', text: '{"hits":["x"]}' }],
    isError: false,
    _meta: {
      receipt: {
        settlement: 'settled',
        tx_digest: '0xtxabc',
        blob_id: 'mem:1',
        amount_atomic: '5000',
        chain: 'sui',
      },
    },
  },
};

test('callTool without options sends no intent headers (backward compatible)', async () => {
  const cap: Capture[] = [];
  const client = createMCPXClient({
    apiKey: 'mcpx_sk_test',
    baseUrl: 'http://gw.test',
    fetchImpl: stubFetch(cap, () => RECEIPT),
  });
  const r = await client.callTool('demo_q', { q: 'sui' });
  assert.equal(cap.length, 1);
  assert.equal(cap[0]!.headers['authorization'], 'Bearer mcpx_sk_test');
  assert.equal(cap[0]!.headers['x-mcpx-intent-id'], undefined);
  assert.equal(cap[0]!.headers['x-mcpx-category'], undefined);
  assert.equal(cap[0]!.body.method, 'tools/call');
  assert.equal(cap[0]!.body.params.name, 'demo_q');
  assert.deepEqual(cap[0]!.body.params.arguments, { q: 'sui' });
  assert.equal(r.isError, false);
  assert.equal(r.receipt.txDigest, '0xtxabc');
  assert.equal(r.receipt.amountAtomic, 5000n);
  assert.equal(r.receipt.chain, 'sui');
  assert.equal(r.receipt.settlement, 'settled');
});

test('callTool with intentId + category sends X-Mcpx headers', async () => {
  const cap: Capture[] = [];
  const client = createMCPXClient({
    apiKey: 'mcpx_sk_test',
    baseUrl: 'http://gw.test',
    fetchImpl: stubFetch(cap, () => RECEIPT),
  });
  await client.callTool(
    'demo_q',
    { q: 'sui' },
    { intentId: '0xintent', category: 'intelligence' },
  );
  assert.equal(cap[0]!.headers['x-mcpx-intent-id'], '0xintent');
  assert.equal(cap[0]!.headers['x-mcpx-category'], 'intelligence');
});

test('client-level default intentId is applied and overridable per call', async () => {
  const cap: Capture[] = [];
  const client = createMCPXClient({
    apiKey: 'k',
    baseUrl: 'http://gw.test',
    intentId: '0xdefault',
    category: 'data',
    fetchImpl: stubFetch(cap, () => RECEIPT),
  });
  await client.callTool('demo_q', {});
  assert.equal(cap[0]!.headers['x-mcpx-intent-id'], '0xdefault');
  assert.equal(cap[0]!.headers['x-mcpx-category'], 'data');
  await client.callTool('demo_q', {}, { intentId: '0xother' });
  assert.equal(cap[1]!.headers['x-mcpx-intent-id'], '0xother');
  assert.equal(cap[1]!.headers['x-mcpx-category'], 'data');
});

test('gateway JSON-RPC error → MCPXError with code', async () => {
  const cap: Capture[] = [];
  const client = createMCPXClient({
    apiKey: 'k',
    baseUrl: 'http://gw.test',
    fetchImpl: stubFetch(cap, () => ({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32014, message: 'intent revoked', data: { error_code: 'intent_revoked' } },
    })),
  });
  await assert.rejects(
    () => client.callTool('demo_q', {}, { intentId: '0xrevoked' }),
    (e: unknown) => e instanceof MCPXError && e.code === 'intent_revoked' && e.rpcCode === -32014,
  );
});

test('tool-level isError → MCPXError carrying _meta.error_code', async () => {
  const cap: Capture[] = [];
  const client = createMCPXClient({
    apiKey: 'k',
    baseUrl: 'http://gw.test',
    fetchImpl: stubFetch(cap, () => ({
      jsonrpc: '2.0',
      id: 1,
      result: {
        content: [{ type: 'text', text: 'over the per-call cap' }],
        isError: true,
        _meta: { error_code: 'intent_per_call_cap_exceeded' },
      },
    })),
  });
  await assert.rejects(
    () => client.callTool('demo_q', {}, { intentId: '0xi' }),
    (e: unknown) =>
      e instanceof MCPXError &&
      e.code === 'intent_per_call_cap_exceeded' &&
      e.message === 'over the per-call cap',
  );
});

test('missing apiKey throws synchronously', () => {
  assert.throws(
    () => createMCPXClient({ apiKey: '' }),
    (e: unknown) => e instanceof MCPXError && e.code === 'auth_required',
  );
});
