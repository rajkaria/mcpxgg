/**
 * Sui address helpers. Pure — no @mysten/sui import, so safe everywhere.
 */

const SUI_ADDR_RE = /^0x[0-9a-fA-F]{1,64}$/;

export function isSuiAddress(v: string): boolean {
  return SUI_ADDR_RE.test(v);
}

/** Left-pads to the canonical 32-byte (0x + 64 hex) form. */
export function normalizeSuiAddress(v: string): string {
  if (!isSuiAddress(v)) throw new Error(`invalid sui address: ${v}`);
  const hex = v.slice(2).toLowerCase().padStart(64, '0');
  return `0x${hex}`;
}
