import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  baseTokens,
  resolveTheme,
  effectiveThemeName,
  tokensToCss,
} from './theme.js';

test('base light/dark differ', () => {
  assert.notEqual(baseTokens('light').bg, baseTokens('dark').bg);
  assert.equal(baseTokens('light').bg, '#ffffff');
  assert.equal(baseTokens('dark').bg, '#0b0d12');
});

test('host CSS custom properties override base tokens', () => {
  const overrides: Record<string, string> = {
    '--mcpx-accent': '  #7c3aed  ',
    '--mcpx-radius': '0px',
  };
  const t = resolveTheme('light', (v) => overrides[v] ?? '');
  assert.equal(t.accent, '#7c3aed');
  assert.equal(t.radius, '0px');
  // untouched token keeps base value
  assert.equal(t.bg, '#ffffff');
});

test('empty custom property does not clobber base', () => {
  const t = resolveTheme('dark', () => '');
  assert.equal(t.accent, baseTokens('dark').accent);
});

test('effectiveThemeName honors explicit attr, else prefers-color-scheme', () => {
  assert.equal(effectiveThemeName('light', true), 'light');
  assert.equal(effectiveThemeName('dark', false), 'dark');
  assert.equal(effectiveThemeName('auto', true), 'dark');
  assert.equal(effectiveThemeName('auto', false), 'light');
});

test('tokensToCss embeds resolved values', () => {
  const css = tokensToCss(resolveTheme('light', () => ''));
  assert.ok(css.includes('#ffffff'));
  assert.ok(css.includes(':host'));
  assert.ok(css.includes('.primary'));
});
