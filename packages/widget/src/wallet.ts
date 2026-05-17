/**
 * Wallet connect (S7-T21).
 *
 * The widget needs a session API key the connected wallet has authorised so
 * the gateway can settle. It does NOT bundle a heavy Privy SDK — instead it
 * detects an integration the host page may already expose, in priority order:
 *
 *   1. `window.mcpx.getSessionKey()` — explicit host hook (recommended; the
 *      host already ran Privy/its own auth and hands us a session key).
 *   2. `window.privy` present  → Privy is configured on the host; ask it.
 *   3. A Sui wallet standard provider (`window.suiWallet` /
 *      `window.__suiWallet`) → bare wallet connect fallback.
 *   4. None → return `needsKey`, the widget renders a manual key field so a
 *      user can paste a key from mcpx.gg/dashboard. Always works.
 *
 * Everything here is pure logic over an injected `globalThis`-like object so
 * it stays unit-testable without a DOM.
 */

export type WalletKind = 'host-hook' | 'privy' | 'sui-wallet' | 'manual';

export interface WalletResolution {
  kind: WalletKind;
  /** Present when a key could be obtained without user paste. */
  apiKey?: string;
  /** True when the UI must show a manual API-key input. */
  needsKey: boolean;
  /** Short label for the connect button / status line. */
  label: string;
}

interface HostHook {
  mcpx?: { getSessionKey?: () => string | Promise<string> };
  privy?: { mcpxSessionKey?: string; getMcpxSessionKey?: () => Promise<string> };
  suiWallet?: unknown;
  __suiWallet?: unknown;
}

/**
 * Inspect the host environment and obtain a session key if possible.
 * `env` defaults to `globalThis` but is injectable for tests.
 */
export async function resolveWallet(
  env: HostHook = globalThis as unknown as HostHook,
): Promise<WalletResolution> {
  // 1. Explicit host hook — the cleanest integration.
  const hook = env.mcpx?.getSessionKey;
  if (typeof hook === 'function') {
    try {
      const key = await hook();
      if (key) {
        return {
          kind: 'host-hook',
          apiKey: key,
          needsKey: false,
          label: 'Connected',
        };
      }
    } catch {
      /* fall through */
    }
  }

  // 2. Privy configured on the host page.
  if (env.privy) {
    const direct = env.privy.mcpxSessionKey;
    if (direct) {
      return { kind: 'privy', apiKey: direct, needsKey: false, label: 'Connected via Privy' };
    }
    const getter = env.privy.getMcpxSessionKey;
    if (typeof getter === 'function') {
      try {
        const key = await getter();
        if (key) {
          return { kind: 'privy', apiKey: key, needsKey: false, label: 'Connected via Privy' };
        }
      } catch {
        /* fall through */
      }
    }
    // Privy present but no key yet → still needs a key, but signal Privy.
    return { kind: 'privy', needsKey: true, label: 'Connect with Privy' };
  }

  // 3. Bare Sui wallet present.
  if (env.suiWallet || env.__suiWallet) {
    return { kind: 'sui-wallet', needsKey: true, label: 'Connect Sui wallet' };
  }

  // 4. Nothing — manual paste path (always works).
  return { kind: 'manual', needsKey: true, label: 'Enter session key' };
}

/** Basic shape check so we fail fast before hitting the gateway. */
export function isLikelySessionKey(v: string): boolean {
  return /^mcpx_sk_[A-Za-z0-9_-]{8,}$/.test(v.trim());
}
