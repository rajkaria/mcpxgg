/**
 * Theme token resolution (S7-T22).
 *
 * Host pages override any token with a CSS custom property on the element,
 * e.g. `<mcpx-call style="--mcpx-accent:#7c3aed">`. We resolve the effective
 * palette in pure TS so it's unit-testable; the element only feeds in the
 * computed-style getter.
 */

export type ThemeName = 'light' | 'dark';

export interface ThemeTokens {
  bg: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  accentText: string;
  error: string;
  success: string;
  radius: string;
  font: string;
}

const LIGHT: ThemeTokens = {
  bg: '#ffffff',
  surface: '#f6f7f9',
  text: '#0b0d12',
  textMuted: '#5b6573',
  border: '#e3e6ea',
  accent: '#5b3df5',
  accentText: '#ffffff',
  error: '#d92d20',
  success: '#067647',
  radius: '12px',
  font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

const DARK: ThemeTokens = {
  bg: '#0b0d12',
  surface: '#15181f',
  text: '#f3f4f6',
  textMuted: '#9aa3b2',
  border: '#262b35',
  accent: '#8b7bff',
  accentText: '#0b0d12',
  error: '#ff6b5e',
  success: '#3ddc84',
  radius: '12px',
  font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
};

/** CSS-custom-property name for each token (host override surface). */
const VAR: Record<keyof ThemeTokens, string> = {
  bg: '--mcpx-bg',
  surface: '--mcpx-surface',
  text: '--mcpx-text',
  textMuted: '--mcpx-text-muted',
  border: '--mcpx-border',
  accent: '--mcpx-accent',
  accentText: '--mcpx-accent-text',
  error: '--mcpx-error',
  success: '--mcpx-success',
  radius: '--mcpx-radius',
  font: '--mcpx-font',
};

export function baseTokens(theme: ThemeName): ThemeTokens {
  return theme === 'dark' ? { ...DARK } : { ...LIGHT };
}

/**
 * Resolve the effective palette: start from the named base theme, then let
 * any non-empty host CSS custom property win. `readVar` returns the trimmed
 * computed value of a custom property (or '' if unset).
 */
export function resolveTheme(
  theme: ThemeName,
  readVar: (cssVar: string) => string,
): ThemeTokens {
  const base = baseTokens(theme);
  const out = { ...base };
  (Object.keys(VAR) as (keyof ThemeTokens)[]).forEach((k) => {
    const override = readVar(VAR[k]).trim();
    if (override) out[k] = override;
  });
  return out;
}

/**
 * Decide the concrete theme from the attribute + the host's color-scheme
 * preference (only consulted when `auto`).
 */
export function effectiveThemeName(
  attr: 'light' | 'dark' | 'auto',
  prefersDark: boolean,
): ThemeName {
  if (attr === 'light' || attr === 'dark') return attr;
  return prefersDark ? 'dark' : 'light';
}

/** Inline `:host` CSS block from resolved tokens. */
export function tokensToCss(t: ThemeTokens): string {
  return `
:host{all:initial;display:inline-block;font-family:${t.font};color:${t.text}}
*{box-sizing:border-box}
.card{background:${t.bg};border:1px solid ${t.border};border-radius:${t.radius};padding:16px;min-width:280px;max-width:420px}
.row{display:flex;align-items:center;gap:8px}
.title{font-weight:600;font-size:14px;margin:0 0 2px}
.sub{color:${t.textMuted};font-size:12px;margin:0 0 12px}
input,textarea{width:100%;font:inherit;font-size:13px;color:${t.text};background:${t.surface};border:1px solid ${t.border};border-radius:8px;padding:8px 10px;margin:4px 0}
button{font:inherit;font-size:13px;font-weight:600;cursor:pointer;border:0;border-radius:8px;padding:9px 14px}
.primary{background:${t.accent};color:${t.accentText};width:100%}
.primary:disabled{opacity:.55;cursor:default}
.ghost{background:transparent;color:${t.accent};padding:4px 0}
.out{margin-top:12px;background:${t.surface};border:1px solid ${t.border};border-radius:8px;padding:10px;font-size:12px;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow:auto}
.err{color:${t.error};font-size:12px;margin-top:8px}
.ok{color:${t.success};font-size:12px}
a{color:${t.accent}}
.foot{margin-top:10px;font-size:11px;color:${t.textMuted};text-align:center}
`;
}
