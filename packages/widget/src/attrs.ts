/**
 * Attribute parsing (S7-T20).
 *
 * `<mcpx-call server="walrus-search" tool="query"
 *             prefill='{"q":"sui"}' theme="dark" gateway="https://...">`
 *
 * Pure, DOM-free so it's unit-testable.
 */

export interface WidgetAttrs {
  server: string;
  tool: string;
  /** Parsed prefill arguments. `{}` if absent/invalid. */
  prefill: Record<string, unknown>;
  /** `light` | `dark` | `auto` (follow prefers-color-scheme). */
  theme: 'light' | 'dark' | 'auto';
  /** Optional gateway override. */
  gateway?: string;
  /** Optional button label override. */
  label?: string;
}

export interface ParseResult {
  attrs: WidgetAttrs;
  /** Non-fatal warnings (e.g. bad prefill JSON) for console hints. */
  warnings: string[];
}

function normalizeTheme(v: string | null | undefined): WidgetAttrs['theme'] {
  const t = (v ?? 'auto').trim().toLowerCase();
  return t === 'light' || t === 'dark' ? t : 'auto';
}

/**
 * Parse a flat attribute bag (what `el.getAttribute` yields) into a typed,
 * validated config. Never throws — surfaces problems as `warnings`.
 */
export function parseWidgetAttrs(
  get: (name: string) => string | null,
): ParseResult {
  const warnings: string[] = [];
  const server = (get('server') ?? '').trim();
  const tool = (get('tool') ?? '').trim();
  if (!server) warnings.push('mcpx-call: missing required `server` attribute');
  if (!tool) warnings.push('mcpx-call: missing required `tool` attribute');

  let prefill: Record<string, unknown> = {};
  const rawPrefill = get('prefill');
  if (rawPrefill && rawPrefill.trim()) {
    try {
      const parsed = JSON.parse(rawPrefill) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        prefill = parsed as Record<string, unknown>;
      } else {
        warnings.push('mcpx-call: `prefill` must be a JSON object — ignored');
      }
    } catch {
      warnings.push('mcpx-call: `prefill` is not valid JSON — ignored');
    }
  }

  const gateway = get('gateway')?.trim() || undefined;
  const label = get('label')?.trim() || undefined;

  return {
    attrs: {
      server,
      tool,
      prefill,
      theme: normalizeTheme(get('theme')),
      ...(gateway ? { gateway } : {}),
      ...(label ? { label } : {}),
    },
    warnings,
  };
}

/** Attributes the custom element observes for live re-render. */
export const OBSERVED_ATTRS = [
  'server',
  'tool',
  'prefill',
  'theme',
  'gateway',
  'label',
] as const;
