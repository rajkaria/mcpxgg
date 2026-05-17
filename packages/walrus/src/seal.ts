/**
 * Seal envelope.
 *
 * Real Seal (threshold IBE over Sui) lands in Sprint 4 (S4-T11). Sprint 3
 * only needs the *envelope shape* stable so the receipt viewer and gateway
 * can be built against it. This implementation is an honest passthrough: it
 * does NOT encrypt. It is gated so it can never be used as if it were real
 * at-rest encryption in production.
 */

const SCHEME = 'plaintext-passthrough-v0' as const;

export interface SealEnvelope {
  scheme: typeof SCHEME;
  /** Sui addresses authorised to decrypt once real Seal lands. */
  recipients: string[];
  /** Base64 of the payload. Plaintext under the passthrough scheme. */
  payloadB64: string;
}

export function sealEncrypt(data: Uint8Array, recipients: string[]): SealEnvelope {
  if (process.env.MCPX_REQUIRE_REAL_SEAL === '1') {
    throw new Error(
      'Seal passthrough refused: MCPX_REQUIRE_REAL_SEAL=1 but real Seal lands in Sprint 4 (S4-T11)',
    );
  }
  return {
    scheme: SCHEME,
    recipients: [...recipients],
    payloadB64: Buffer.from(data).toString('base64'),
  };
}

export function sealDecrypt(envelope: SealEnvelope): Uint8Array {
  if (envelope.scheme !== SCHEME) {
    throw new Error(`unknown seal scheme: ${(envelope as { scheme: string }).scheme}`);
  }
  return new Uint8Array(Buffer.from(envelope.payloadB64, 'base64'));
}
