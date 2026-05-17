/**
 * @mcpxgg/widget — the embeddable `<mcpx-call>` Web Component.
 *
 * Wired in Sprint 7 (S7-T20..T26). Drop one script tag on any page:
 *
 *   <script type="module"
 *     src="https://unpkg.com/@mcpxgg/widget/dist/mcpx-widget.esm.js"></script>
 *   <mcpx-call server="walrus-search" tool="query"
 *              prefill='{"q":"sui"}'></mcpx-call>
 *
 * Or via npm:
 *
 *   import '@mcpxgg/widget';            // auto-registers <mcpx-call>
 *   import { defineMcpxCall } from '@mcpxgg/widget';
 *   defineMcpxCall('my-mcpx-call');     // or register under a custom tag
 *
 * Every call settles on-chain in USDsui through the public mcpx.gg gateway
 * and exposes the receipt; the widget reuses `@mcpxgg/sdk` for the call so it
 * never re-implements the x402 settlement dance.
 */

export const WIDGET_VERSION = '0.1.0';

export { McpxCallElement, defineMcpxCall } from './element.js';
export {
  callThroughGateway,
  qualifiedToolName,
  extractText,
  receiptExplorerUrl,
  DEFAULT_GATEWAY_URL,
  MCPXError,
} from './gateway.js';
export type { WidgetCallInput, WidgetCallResult } from './gateway.js';
export { parseWidgetAttrs, OBSERVED_ATTRS } from './attrs.js';
export type { WidgetAttrs, ParseResult } from './attrs.js';
export {
  resolveTheme,
  baseTokens,
  effectiveThemeName,
  tokensToCss,
} from './theme.js';
export type { ThemeTokens, ThemeName } from './theme.js';
export { resolveWallet, isLikelySessionKey } from './wallet.js';
export type { WalletResolution, WalletKind } from './wallet.js';

import { defineMcpxCall } from './element.js';

// Auto-register on import in a browser. No-op in Node/SSR.
defineMcpxCall();
