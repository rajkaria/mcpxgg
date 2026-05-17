import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMCPXServer } from './index.js';
import type { ToolStreamChunk } from './types.js';

function rpc(
  method: string,
  params?: Record<string, unknown>,
  headers?: Record<string, string>,
) {
  return new Request('http://srv/', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(headers ?? {}) },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
}

function streamServer() {
  const s = createMCPXServer({ namespace: 'stream-demo' });
  s.tool('lines', {
    description: 'streams N lines',
    inputSchema: { type: 'object', properties: { n: { type: 'number' } } },
    pricing: { perCallAtomic: 1_000n },
    handler: async function* (args): AsyncGenerator<ToolStreamChunk> {
      const n = Number(args.n ?? 3);
      for (let i = 0; i < n; i++) {
        yield { text: `line-${i}`, priceAtomic: 1_000n };
      }
    },
  });
  return s;
}

async function readSse(res: Response): Promise<Array<{ event: string; data: string }>> {
  const text = await res.text();
  const out: Array<{ event: string; data: string }> = [];
  for (const frame of text.split('\n\n')) {
    if (!frame.trim()) continue;
    let event = 'message';
    let data = '';
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data = line.slice(5).trim();
    }
    out.push({ event, data });
  }
  return out;
}

test('SSE: streaming handler emits one chunk event per yield + done', async () => {
  const s = streamServer();
  const res = await s.fetch(
    rpc('tools/call', { name: 'lines', arguments: { n: 5 } }, { accept: 'text/event-stream' }),
  );
  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  const events = await readSse(res);
  const chunks = events.filter((e) => e.event === 'chunk');
  assert.equal(chunks.length, 5);
  assert.deepEqual(JSON.parse(chunks[0]!.data), { text: 'line-0', priceAtomic: '1000' });
  assert.equal(events.at(-1)?.event, 'done');
});

test('non-SSE caller still gets a single JSON-RPC result (backward compat)', async () => {
  const s = streamServer();
  const res = await s.fetch(rpc('tools/call', { name: 'lines', arguments: { n: 3 } }));
  assert.equal(res.headers.get('content-type')?.includes('application/json'), true);
  const body = (await res.json()) as {
    result: { content: Array<{ text: string }>; isError: boolean };
  };
  assert.equal(body.result.content.length, 3);
  assert.equal(body.result.content[0]?.text, 'line-0');
  assert.equal(body.result.isError, false);
});

test('non-streaming handler unaffected by Accept: text/event-stream', async () => {
  const s = createMCPXServer({ namespace: 'plain' });
  s.tool('echo', {
    description: 'echo',
    inputSchema: {},
    pricing: { perCallAtomic: 1n },
    handler: (a) => ({ got: a.x }),
  });
  const res = await s.fetch(
    rpc('tools/call', { name: 'echo', arguments: { x: 42 } }, { accept: 'text/event-stream' }),
  );
  const body = (await res.json()) as { result: { content: Array<{ text: string }> } };
  assert.match(body.result.content[0]!.text, /"got":42/);
});

test('SSE stream surfaces a handler error as an error event', async () => {
  const s = createMCPXServer({ namespace: 'boom' });
  s.tool('explode', {
    description: 'throws mid-stream',
    inputSchema: {},
    pricing: { perCallAtomic: 1n },
    handler: async function* (): AsyncGenerator<ToolStreamChunk> {
      yield { text: 'ok-1' };
      throw new Error('kaboom');
    },
  });
  const res = await s.fetch(
    rpc('tools/call', { name: 'explode' }, { accept: 'text/event-stream' }),
  );
  const events = await readSse(res);
  assert.equal(events.filter((e) => e.event === 'chunk').length, 1);
  const errEvent = events.find((e) => e.event === 'error');
  assert.ok(errEvent);
  assert.match(JSON.parse(errEvent!.data).message, /kaboom/);
});
