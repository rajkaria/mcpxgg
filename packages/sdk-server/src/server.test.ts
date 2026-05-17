import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMCPXServer } from './index.js';

function jsonRpc(method: string, params?: Record<string, unknown>, headers?: Record<string, string>) {
  return new Request('http://srv/', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(headers ?? {}) },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
}

function build() {
  const s = createMCPXServer({ namespace: 'demo', description: 'demo server' });
  s.tool('echo', {
    description: 'echoes input',
    inputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] },
    pricing: { perCallAtomic: 5_000n, freeTierCallsPerUser: 3 },
    handler: (args, ctx) => ({ echoed: args.msg, payer: ctx.payerAddress ?? null }),
  });
  return s;
}

test('manifest serializes price as string and includes tool', () => {
  const m = build().manifest();
  assert.equal(m.namespace, 'demo');
  assert.equal(m.tools.length, 1);
  assert.equal(m.tools[0]?.priceAtomic, '5000');
  assert.equal(m.tools[0]?.freeTierCallsPerUser, 3);
  assert.equal(m.tools[0]?.timeoutSeconds, 30);
});

test('duplicate tool registration throws', () => {
  const s = build();
  assert.throws(() =>
    s.tool('echo', {
      description: 'x',
      inputSchema: {},
      pricing: { perCallAtomic: 1n },
      handler: () => 'x',
    }),
  );
});

test('initialize returns protocol + serverInfo', async () => {
  const res = await build().fetch(jsonRpc('initialize'));
  const body = (await res.json()) as { result: { serverInfo: { name: string } } };
  assert.equal(body.result.serverInfo.name, 'mcpxgg/demo');
});

test('tools/list returns schema, not pricing', async () => {
  const res = await build().fetch(jsonRpc('tools/list'));
  const body = (await res.json()) as { result: { tools: Array<Record<string, unknown>> } };
  assert.equal(body.result.tools.length, 1);
  assert.equal(body.result.tools[0]?.name, 'echo');
  assert.ok(!('pricing' in (body.result.tools[0] as object)));
});

test('tools/call invokes handler and surfaces gateway-injected ctx', async () => {
  const res = await build().fetch(
    jsonRpc(
      'tools/call',
      { name: 'echo', arguments: { msg: 'hi' } },
      { 'x-mcpx-payer': '0xpayer', 'x-mcpx-tx-digest': '0xtx', 'x-mcpx-request-id': 'req-1' },
    ),
  );
  const body = (await res.json()) as {
    result: { content: Array<{ text: string }>; isError: boolean };
  };
  assert.equal(body.result.isError, false);
  const payload = JSON.parse(body.result.content[0]!.text) as { echoed: string; payer: string };
  assert.equal(payload.echoed, 'hi');
  assert.equal(payload.payer, '0xpayer');
});

test('unknown tool yields -32601', async () => {
  const res = await build().fetch(jsonRpc('tools/call', { name: 'nope' }));
  const body = (await res.json()) as { error?: { code: number } };
  assert.equal(body.error?.code, -32601);
});

test('handler throw becomes isError content, not transport error', async () => {
  const s = createMCPXServer({ namespace: 'demo' });
  s.tool('boom', {
    description: 'throws',
    inputSchema: {},
    pricing: { perCallAtomic: 1n },
    handler: () => {
      throw new Error('kaboom');
    },
  });
  const res = await s.fetch(jsonRpc('tools/call', { name: 'boom' }));
  const body = (await res.json()) as {
    result: { content: Array<{ text: string }>; isError: boolean };
  };
  assert.equal(body.result.isError, true);
  assert.match(body.result.content[0]!.text, /kaboom/);
});
