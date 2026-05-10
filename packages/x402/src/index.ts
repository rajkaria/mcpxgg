/**
 * @mcpxgg/x402 — x402 spec types and Sui scheme client.
 *
 * Wired in Sprint 2.
 */

export const X402_VERSION = '0.1.0';

export type Scheme = 'exact' | 'upto';

export interface PaymentDetails {
  scheme: Scheme;
  network: string; // 'sui-mainnet' | 'sui-testnet' | future: 'base-mainnet', 'solana-mainnet'
  receiver: string; // server's address or session's address depending on flow
  amountAtomic: bigint;
  tokenType: string;
  validUntilMs: number;
  metadata?: Record<string, unknown>;
}

export interface PaymentPayload {
  signature: string;
  payerAddress: string;
  sessionObjectId?: string;
  intentId?: string;
  details: PaymentDetails;
}

export interface VerifyResult {
  isValid: boolean;
  invalidReason?: string;
}

export interface SettleResult {
  success: boolean;
  txDigest?: string;
  errorMessage?: string;
}

export interface SupportedResult {
  schemes: Scheme[];
  networks: string[];
}
