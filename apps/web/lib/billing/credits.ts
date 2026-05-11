/**
 * Deprecation stubs for the legacy credit-debit gateway path.
 *
 * The Sprint-1 chain rebuild removed the credit ledger entirely — pricing is
 * now `priceAtomic: bigint` settled on-chain via the x402 facilitator
 * (`apps/facilitator`) and the upcoming gateway split (`apps/gateway`,
 * Sprint 3 / S3-T01..T11). The old `lib/gateway/*` files are kept around as
 * a template for S3-T01 but their `lib/billing/*` dependencies are gone.
 *
 * These stubs satisfy the typechecker so the web build stays green during
 * the Sprint 2 → Sprint 3 hand-off. They MUST NOT be called at runtime — the
 * legacy gateway path is no longer routed to (see S3-T11). Calling them
 * throws so anyone wiring them back in trips immediately.
 *
 * Do not extend this surface. Razorpay/Stripe/credit-ledger patterns are out
 * (REUSE-MAP.md). Sprint 3 deletes this whole tree.
 */

interface DebitArgs {
  userId: string;
  amount: number;
  mcpServerId?: string;
  toolName?: string;
  description: string;
}

interface RefundArgs {
  userId: string;
  amount: number;
  description: string;
}

function deprecated(name: string): never {
  throw new Error(
    `lib/billing/${name}: removed in Sprint 1 (chain rebuild). ` +
      `Use the on-chain settle_call PTB via apps/facilitator (Sprint 2) or ` +
      `apps/gateway → /settle (Sprint 3, S3-T04). See REUSE-MAP.md.`,
  );
}

export async function debitCredits(_args: DebitArgs): Promise<void> {
  deprecated('credits.debitCredits');
}

export async function refundCredits(_args: RefundArgs): Promise<void> {
  deprecated('credits.refundCredits');
}
