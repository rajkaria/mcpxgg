import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  callThroughGateway,
  qualifiedToolName,
  extractText,
  receiptExplorerUrl,
  MCPXError,
} from './gateway.js';

test('qualifiedToolName prefixes server when not already qualified', () => {
  assert.equal(qualifiedToolName('walrus-search', 'query'), 'walrus-search_query');
});

test('qualifiedToolName does not double-prefix an already-qualified tool', () => {
  assert.equal(
    qualifiedToolName('walrus-search', 'walrus-search_query'),
    'walrus-search_query',
  );
});

test('qualifiedToolName trims and validates required parts', () => {
  assert.equal(qualifiedToolName('  s  ', '  t  '), 's_t');
  assert.throws(() => qualifiedToolName('', 'q'), (e) => e instanceof MCPXError);
  assert.throws(() => qualifiedToolName('s', ''), (e) => e instanceof MCPXError);
});

test('extractText pulls the first text blob, falls back to JSON', () => {
  assert.equal(extractText([{ type: 'text', text: 'hello' }]), 'hello');
  assert.equal(extractText('raw'), 'raw');
  assert.equal(extractText({ a: 1 }), '{\n  "a": 1\n}');
});

test('receiptExplorerUrl builds a suiscan tx link', () => {
  assert.equal(receiptExplorerUrl('0xabc'), 'https://suiscan.xyz/tx/0xabc');
});

test('callThroughGateway reuses the SDK client and maps the receipt', async () => {
  const calls = [];
  const fetchImpl = async (input, init) => {
    calls.push({ url: String(input), body: JSON.parse(String(init.body)) });
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [{ type: 'text', text: '{"hits":2}' }],
          isError: false,
          _meta: {
            receipt: {
              settlement: 'settled',
              tx_digest: '0xtx',
              blob_id: 'mem:9',
              amount_atomic: '4200',
              chain: 'sui',
            },
          },
        },
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  };

  const res = await callThroughGateway({
    server: 'walrus-search',
    tool: 'query',
    args: { q: 'sui' },
    apiKey: 'mcpx_sk_test123',
    gatewayUrl: 'http://gw.test',
    fetchImpl,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://gw.test/');
  assert.equal(calls[0].body.params.name, 'walrus-search_query');
  assert.deepEqual(calls[0].body.params.arguments, { q: 'sui' });
  assert.equal(res.text, '{"hits":2}');
  assert.equal(res.txDigest, '0xtx');
  assert.equal(res.amountAtomic, 4200n);
  assert.equal(res.chain, 'sui');
  assert.equal(res.settlement, 'settled');
});

test('callThroughGateway surfaces gateway errors as MCPXError', async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32014, message: 'nope', data: { error_code: 'intent_revoked' } },
      }),
      { headers: { 'content-type': 'application/json' } },
    );
  await assert.rejects(
    () =>
      callThroughGateway({
        server: 's',
        tool: 't',
        args: {},
        apiKey: 'mcpx_sk_x',
        fetchImpl,
      }),
    (e) => e instanceof MCPXError && e.code === 'intent_revoked',
  );
});
