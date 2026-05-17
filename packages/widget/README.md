# @mcpxgg/widget

The embeddable **`<mcpx-call>`** Web Component. Drop one tag on any page —
Notion, a personal site, a docs page — and your visitors can call any MCP
server tool on the [mcpx.gg](https://mcpx.gg) marketplace. Every call settles
on-chain in USDsui and links the permanent receipt.

Zero framework. Shadow DOM (no style bleed in or out). Themeable with CSS
custom properties. Reuses [`@mcpxgg/sdk`](../sdk-client) for the actual call so
it never re-implements the x402 settlement dance.

## CDN (no build step)

```html
<script
  type="module"
  src="https://unpkg.com/@mcpxgg/widget/dist/mcpx-widget.esm.js"
></script>

<mcpx-call
  server="walrus-search"
  tool="query"
  prefill='{"q":"sui"}'
></mcpx-call>
```

Classic (non-module) script tag also works:

```html
<script src="https://unpkg.com/@mcpxgg/widget/dist/mcpx-widget.js"></script>
```

## npm

```bash
npm i @mcpxgg/widget
```

```ts
import '@mcpxgg/widget'; // auto-registers <mcpx-call>
```

## Attributes

| Attribute  | Required | Description                                                       |
| ---------- | -------- | ----------------------------------------------------------------- |
| `server`   | yes      | Marketplace namespace, e.g. `walrus-search`.                      |
| `tool`     | yes      | Tool name on that server, e.g. `query`.                           |
| `prefill`  | no       | JSON object of prefilled tool args, e.g. `'{"q":"sui"}'`.        |
| `theme`    | no       | `light` \| `dark` \| `auto` (default; follows OS preference).     |
| `gateway`  | no       | Override the public gateway URL.                                  |
| `label`    | no       | Custom call-button label.                                         |

## Theming

Override any token via CSS custom properties on (or above) the element:

```html
<mcpx-call
  server="walrus-search"
  tool="query"
  style="--mcpx-accent:#7c3aed; --mcpx-radius:4px"
></mcpx-call>
```

Tokens: `--mcpx-bg`, `--mcpx-surface`, `--mcpx-text`, `--mcpx-text-muted`,
`--mcpx-border`, `--mcpx-accent`, `--mcpx-accent-text`, `--mcpx-error`,
`--mcpx-success`, `--mcpx-radius`, `--mcpx-font`. Style the Shadow parts
`card`, `button`, `wallet`, `result`, `error` via `::part()`.

## Wallet / auth

The widget needs an mcpx **session key** (`mcpx_sk_…`) the connected wallet
authorised. It resolves one, in priority order:

1. `window.mcpx.getSessionKey()` — explicit host hook (recommended).
2. `window.privy` present → Privy path.
3. A Sui wallet provider → bare wallet connect fallback.
4. None → renders a manual key field (paste from
   [mcpx.gg/dashboard](https://mcpx.gg/dashboard)). Always works.

## Events

`mcpx:result` (`detail` = `WidgetCallResult`) and `mcpx:error` bubble from the
element.

## Live demo

[`examples/third-party-site.html`](./examples/third-party-site.html) — a
standalone page that embeds `<mcpx-call server="walrus-search">` and works
with one click. Build then open it:

```bash
pnpm --filter @mcpxgg/widget build
open packages/widget/examples/third-party-site.html
```

## Build output

- `dist/index.js` + `dist/*.d.ts` — npm ESM package (`tsc`).
- `dist/mcpx-widget.esm.js` — single-file ESM, dependency-inlined (CDN).
- `dist/mcpx-widget.js` — single-file IIFE (classic `<script>`, CDN).
