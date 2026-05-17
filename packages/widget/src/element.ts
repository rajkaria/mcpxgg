/**
 * <mcpx-call> custom element (S7-T20..T22).
 *
 * Zero-framework, Shadow DOM for full style isolation, themeable via CSS
 * custom properties. All non-DOM logic lives in the sibling pure modules
 * (gateway / attrs / theme / wallet) which are unit-tested; this file is the
 * thin DOM shell that wires them together.
 */

import { OBSERVED_ATTRS, parseWidgetAttrs, type WidgetAttrs } from './attrs.js';
import {
  callThroughGateway,
  receiptExplorerUrl,
  MCPXError,
} from './gateway.js';
import {
  effectiveThemeName,
  resolveTheme,
  tokensToCss,
} from './theme.js';
import {
  isLikelySessionKey,
  resolveWallet,
  type WalletResolution,
} from './wallet.js';

const TAG = 'mcpx-call';

export class McpxCallElement extends HTMLElement {
  static get observedAttributes(): readonly string[] {
    return OBSERVED_ATTRS;
  }

  private root: ShadowRoot;
  private wallet: WalletResolution | null = null;
  private busy = false;
  private resultText: string | null = null;
  private receiptUrl: string | null = null;
  private errorText: string | null = null;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    void this.init();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.render();
  }

  private async init(): Promise<void> {
    try {
      this.wallet = await resolveWallet();
    } catch {
      this.wallet = { kind: 'manual', needsKey: true, label: 'Enter session key' };
    }
    this.render();
  }

  private config(): WidgetAttrs {
    const { attrs, warnings } = parseWidgetAttrs((n) => this.getAttribute(n));
    for (const w of warnings) console.warn(w);
    return attrs;
  }

  private themeCss(cfg: WidgetAttrs): string {
    const prefersDark =
      typeof globalThis.matchMedia === 'function' &&
      globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
    const name = effectiveThemeName(cfg.theme, prefersDark);
    const cs = globalThis.getComputedStyle?.(this);
    const tokens = resolveTheme(name, (v) =>
      cs ? cs.getPropertyValue(v) : '',
    );
    return tokensToCss(tokens);
  }

  private currentKey(): string {
    if (this.wallet?.apiKey) return this.wallet.apiKey;
    const input =
      this.root.querySelector<HTMLInputElement>('input[name="mcpx-key"]');
    return input?.value.trim() ?? '';
  }

  private collectArgs(cfg: WidgetAttrs): Record<string, unknown> {
    const args: Record<string, unknown> = { ...cfg.prefill };
    this.root
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-arg]')
      .forEach((el) => {
        const k = el.getAttribute('data-arg');
        if (k && el.value !== '') args[k] = el.value;
      });
    return args;
  }

  private async run(): Promise<void> {
    if (this.busy) return;
    const cfg = this.config();
    const apiKey = this.currentKey();
    this.errorText = null;
    this.resultText = null;
    this.receiptUrl = null;

    if (!apiKey || !isLikelySessionKey(apiKey)) {
      this.errorText =
        'A valid mcpx session key (mcpx_sk_…) is required to call this tool.';
      this.render();
      return;
    }

    this.busy = true;
    this.render();
    try {
      const res = await callThroughGateway({
        server: cfg.server,
        tool: cfg.tool,
        args: this.collectArgs(cfg),
        apiKey,
        ...(cfg.gateway ? { gatewayUrl: cfg.gateway } : {}),
      });
      this.resultText = res.text;
      this.receiptUrl = res.txDigest
        ? receiptExplorerUrl(res.txDigest)
        : null;
      this.dispatchEvent(
        new CustomEvent('mcpx:result', { detail: res, bubbles: true }),
      );
    } catch (e) {
      this.errorText =
        e instanceof MCPXError
          ? `${e.message} (${e.code})`
          : e instanceof Error
            ? e.message
            : 'Call failed';
      this.dispatchEvent(
        new CustomEvent('mcpx:error', {
          detail: { message: this.errorText },
          bubbles: true,
        }),
      );
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private render(): void {
    const cfg = this.config();
    const needsKey = !this.wallet?.apiKey;
    const label = cfg.label ?? `Call ${cfg.server}`;
    const esc = (s: string): string =>
      s.replace(/[&<>"]/g, (c) =>
        c === '&'
          ? '&amp;'
          : c === '<'
            ? '&lt;'
            : c === '>'
              ? '&gt;'
              : '&quot;',
      );

    const argFields = Object.keys(cfg.prefill)
      .map(
        (k) =>
          `<input data-arg="${esc(k)}" placeholder="${esc(k)}" value="${esc(
            String(cfg.prefill[k] ?? ''),
          )}" />`,
      )
      .join('');

    const keyField = needsKey
      ? `<input name="mcpx-key" type="password" placeholder="mcpx_sk_… (from mcpx.gg/dashboard)" autocomplete="off" />`
      : '';

    const status = this.wallet
      ? `<button class="ghost" part="wallet">${esc(this.wallet.label)}</button>`
      : '';

    const output = this.errorText
      ? `<div class="err" part="error">${esc(this.errorText)}</div>`
      : this.resultText !== null
        ? `<div class="out" part="result">${esc(this.resultText)}</div>${
            this.receiptUrl
              ? `<div class="foot"><a href="${esc(
                  this.receiptUrl,
                )}" target="_blank" rel="noreferrer">View on-chain receipt ↗</a></div>`
              : ''
          }`
        : '';

    this.root.innerHTML = `<style>${this.themeCss(cfg)}</style>
<div class="card" part="card">
  <p class="title">${esc(cfg.server)} · ${esc(cfg.tool)}</p>
  <p class="sub">Settles on-chain in USDsui via mcpx.gg</p>
  ${argFields}
  ${keyField}
  <button class="primary" part="button" ${this.busy ? 'disabled' : ''}>
    ${this.busy ? 'Calling…' : esc(label)}
  </button>
  ${status}
  ${output}
  <div class="foot">Powered by <a href="https://mcpx.gg" target="_blank" rel="noreferrer">MCPX</a></div>
</div>`;

    const btn = this.root.querySelector<HTMLButtonElement>('button.primary');
    btn?.addEventListener('click', () => void this.run());
  }
}

/** Idempotently register the custom element. Safe to call many times. */
export function defineMcpxCall(tag: string = TAG): void {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(tag)) {
    customElements.define(tag, McpxCallElement);
  }
}
