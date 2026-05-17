# Embed MCPX anywhere with `<mcpx-call>`

The [`@mcpxgg/widget`](https://www.npmjs.com/package/@mcpxgg/widget) package
ships a single, framework-agnostic Web Component — **`<mcpx-call>`** — that
lets *any* page call an MCP server tool on the marketplace. Every call settles
on-chain in USDsui and links the permanent receipt.

> One `<script>` tag, one element. No backend, no framework, no build step.
> Shadow DOM keeps the host page's styles out and the widget's styles in.

---

## 1. The one-tag embed (CDN)

Paste this into any HTML — a blog, a Notion embed, a docs page, a landing
page:

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

A classic (non-module) bundle is published too, for pages that can't use
`type="module"`:

```html
<script src="https://unpkg.com/@mcpxgg/widget/dist/mcpx-widget.js"></script>
<mcpx-call server="walrus-search" tool="query"></mcpx-call>
```

## 2. Install from npm

For app bundles that prefer a dependency over a CDN:

```bash
npm i @mcpxgg/widget
```

```ts
import '@mcpxgg/widget'; // side-effect import auto-registers <mcpx-call>
```

or register under a custom tag name:

```ts
import { defineMcpxCall } from '@mcpxgg/widget';
defineMcpxCall('my-call');
```

## 3. Attributes

| Attribute | Required | Description                                                  |
| --------- | -------- | ------------------------------------------------------------ |
| `server`  | yes      | Marketplace namespace, e.g. `walrus-search`.                |
| `tool`    | yes      | Tool name on that server, e.g. `query`.                      |
| `prefill` | no       | JSON object of prefilled args, e.g. `'{"q":"sui"}'`.       |
| `theme`   | no       | `light` \| `dark` \| `auto` (default — follows OS).         |
| `gateway` | no       | Override the public gateway URL.                            |
| `label`   | no       | Custom call-button label.                                   |

The widget emits bubbling `mcpx:result` and `mcpx:error` events whose
`detail` carries the tool output and the on-chain receipt.

## 4. Theming (S7-T22)

Default light and dark themes are built in. Override any token with a plain
CSS custom property — on the element or any ancestor:

```html
<mcpx-call
  server="walrus-search"
  tool="query"
  theme="dark"
  style="--mcpx-accent:#7c3aed; --mcpx-radius:4px"
></mcpx-call>
```

Tokens: `--mcpx-bg`, `--mcpx-surface`, `--mcpx-text`, `--mcpx-text-muted`,
`--mcpx-border`, `--mcpx-accent`, `--mcpx-accent-text`, `--mcpx-error`,
`--mcpx-success`, `--mcpx-radius`, `--mcpx-font`. The Shadow parts
`card`, `button`, `wallet`, `result`, `error` are exposed for `::part()`.

## 5. Wallet & auth (S7-T21)

The widget needs an mcpx **session key** (`mcpx_sk_…`) the connected wallet
has authorised. It resolves one in priority order, degrading gracefully:

1. **`window.mcpx.getSessionKey()`** — explicit host hook. Recommended: your
   app already ran Privy / its own auth and hands the widget a key.
2. **`window.privy`** present → the Privy path (host has Privy configured).
3. A **Sui wallet** provider → bare wallet-connect fallback.
4. **Nothing** → the widget renders a manual key field so a visitor can
   paste a key from [mcpx.gg/dashboard](https://mcpx.gg/dashboard). This path
   always works, even on a fully static third-party page.

So the same embed works whether the host page knows about Privy or not.

## 6. Live, copy-paste example

The exact snippet below is the same one running on the
[mcpx.gg landing page](https://mcpx.gg) and on every
[marketplace server detail page](https://mcpx.gg/marketplace):

```html
<script type="module"
  src="https://unpkg.com/@mcpxgg/widget/dist/mcpx-widget.esm.js"></script>

<mcpx-call
  server="walrus-search"
  tool="query"
  prefill='{"q":"on-chain receipts"}'
  theme="auto">
</mcpx-call>
```

## 7. Working third-party demo

A committed, standalone HTML page that embeds
`<mcpx-call server="walrus-search">` from a third-party-style site (a fake
personal blog) and works with **one click**:

- Source: [`packages/widget/examples/third-party-site.html`](https://github.com/rajkaria/mcpxgg/blob/main/packages/widget/examples/third-party-site.html)

Build the bundle and open it locally:

```bash
pnpm --filter @mcpxgg/widget build
open packages/widget/examples/third-party-site.html
```

That page contains nothing MCPX-specific except one script tag and two
`<mcpx-call>` elements — the entire integration surface.
