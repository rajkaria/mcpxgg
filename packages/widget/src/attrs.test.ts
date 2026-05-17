import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWidgetAttrs } from './attrs.js';

function bag(o: Record<string, string>) {
  return (n: string): string | null => (n in o ? o[n]! : null);
}

test('parses required + prefill JSON object', () => {
  const { attrs, warnings } = parseWidgetAttrs(
    bag({ server: 'walrus-search', tool: 'query', prefill: '{"q":"sui"}' }),
  );
  assert.equal(attrs.server, 'walrus-search');
  assert.equal(attrs.tool, 'query');
  assert.deepEqual(attrs.prefill, { q: 'sui' });
  assert.equal(attrs.theme, 'auto');
  assert.equal(warnings.length, 0);
});

test('warns and ignores invalid prefill JSON', () => {
  const { attrs, warnings } = parseWidgetAttrs(
    bag({ server: 's', tool: 't', prefill: '{not json' }),
  );
  assert.deepEqual(attrs.prefill, {});
  assert.ok(warnings.some((w) => w.includes('not valid JSON')));
});

test('warns when prefill is a JSON array, not an object', () => {
  const { attrs, warnings } = parseWidgetAttrs(
    bag({ server: 's', tool: 't', prefill: '[1,2]' }),
  );
  assert.deepEqual(attrs.prefill, {});
  assert.ok(warnings.some((w) => w.includes('must be a JSON object')));
});

test('warns on missing server / tool', () => {
  const { warnings } = parseWidgetAttrs(bag({}));
  assert.ok(warnings.some((w) => w.includes('`server`')));
  assert.ok(warnings.some((w) => w.includes('`tool`')));
});

test('normalizes theme + passes through gateway/label', () => {
  const a = parseWidgetAttrs(
    bag({ server: 's', tool: 't', theme: 'DARK', gateway: 'http://x', label: 'Go' }),
  ).attrs;
  assert.equal(a.theme, 'dark');
  assert.equal(a.gateway, 'http://x');
  assert.equal(a.label, 'Go');
  const b = parseWidgetAttrs(bag({ server: 's', tool: 't', theme: 'weird' })).attrs;
  assert.equal(b.theme, 'auto');
});
