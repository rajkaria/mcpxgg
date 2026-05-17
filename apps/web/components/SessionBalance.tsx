/**
 * <SessionBalance /> (S4-T08) — server component reading the chain_balances
 * mirror. No chain RPC on the hot path (ADR-011).
 */

import { getCurrentUser } from "@/lib/auth/current-user";
import { getSessionBalance, usdsui } from "@/lib/chain/reads";

export async function SessionBalance() {
  const user = await getCurrentUser();
  if (!user?.suiAddress) {
    return (
      <div className="rounded-lg border border-[var(--border)] p-4 text-sm">
        No Sui wallet linked yet. Sign in with a wallet to create a session.
      </div>
    );
  }
  const bal = await getSessionBalance(user.suiAddress);
  if (!bal) {
    return (
      <div className="rounded-lg border border-[var(--border)] p-4 text-sm">
        No active session. Recharge USDsui to create one.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <div className="text-xs opacity-60">Session balance</div>
      <div className="text-2xl font-semibold">{usdsui(bal.balanceAtomic)} USDsui</div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs opacity-70">
        <span>Deposited: {usdsui(bal.lifetimeDepositedAtomic)}</span>
        <span>Spent: {usdsui(bal.lifetimeSpentAtomic)}</span>
        {bal.perCallCapAtomic > 0n && (
          <span>Per-call cap: {usdsui(bal.perCallCapAtomic)}</span>
        )}
        {bal.perDayCapAtomic > 0n && (
          <span>Per-day cap: {usdsui(bal.perDayCapAtomic)}</span>
        )}
      </div>
      <code className="mt-2 block text-[10px] opacity-50">
        {bal.sessionObjectId}
      </code>
    </div>
  );
}
