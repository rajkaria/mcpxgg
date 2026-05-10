/// MCPX developer vault — accrues developer earnings (default 97.5% of every
/// settled call against one of their tools, per ADR-004). The vault is shared
/// so the settlement module can credit it without needing an owned reference,
/// but `claim` is owner-gated.
///
/// `auto_claim_threshold_atomic = 0` means manual claim only; non-zero arms a
/// future Sprint-12 hook (auto-compound into Cetus / Scallop). Until that's
/// wired, the threshold is just stored — not enforced.
module mcpx::vault;

use mcpx::events;
use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin;

const E_NOT_OWNER: u64 = 1;
const E_NOTHING_TO_CLAIM: u64 = 2;

public struct DeveloperVault<phantom T> has key {
    id: UID,
    owner: address,
    accrued_balance: Balance<T>,
    lifetime_earnings_atomic: u64,
    lifetime_claimed_atomic: u64,
    auto_claim_threshold_atomic: u64,
}

/// Anyone can create their own vault. Settlement requires the vault owner to
/// match the server owner — see `settlement::settle_call`.
public fun create<T>(ctx: &mut TxContext) {
    let owner = ctx.sender();
    let vault = DeveloperVault<T> {
        id: object::new(ctx),
        owner,
        accrued_balance: balance::zero<T>(),
        lifetime_earnings_atomic: 0,
        lifetime_claimed_atomic: 0,
        auto_claim_threshold_atomic: 0,
    };
    let vault_id = object::id(&vault);
    transfer::share_object(vault);
    events::emit_vault_created(vault_id, owner);
}

/// Internal: called by `settlement::settle_call` to credit dev share.
public(package) fun accrue<T>(vault: &mut DeveloperVault<T>, payment: Balance<T>) {
    let amount = balance::value(&payment);
    balance::join(&mut vault.accrued_balance, payment);
    vault.lifetime_earnings_atomic = vault.lifetime_earnings_atomic + amount;
    events::emit_vault_accrued(
        object::uid_to_inner(&vault.id),
        amount,
        balance::value(&vault.accrued_balance),
        vault.lifetime_earnings_atomic,
    );
}

/// Withdraws the entire accrued balance to the owner. Aborts if empty so
/// users don't waste gas on an empty claim.
public fun claim<T>(vault: &mut DeveloperVault<T>, clock: &Clock, ctx: &mut TxContext) {
    assert!(vault.owner == ctx.sender(), E_NOT_OWNER);
    let amount = balance::value(&vault.accrued_balance);
    assert!(amount > 0, E_NOTHING_TO_CLAIM);
    let coin = coin::from_balance(balance::withdraw_all(&mut vault.accrued_balance), ctx);
    vault.lifetime_claimed_atomic = vault.lifetime_claimed_atomic + amount;
    events::emit_vault_claimed(
        object::uid_to_inner(&vault.id),
        vault.owner,
        amount,
        clock::timestamp_ms(clock),
    );
    transfer::public_transfer(coin, vault.owner);
}

public fun set_auto_claim_threshold<T>(
    vault: &mut DeveloperVault<T>,
    new_threshold: u64,
    ctx: &TxContext,
) {
    assert!(vault.owner == ctx.sender(), E_NOT_OWNER);
    vault.auto_claim_threshold_atomic = new_threshold;
}

// ─── Read accessors ─────────────────────────────────────────────────────────

public fun owner<T>(v: &DeveloperVault<T>): address { v.owner }

public fun accrued_balance<T>(v: &DeveloperVault<T>): u64 {
    balance::value(&v.accrued_balance)
}

public fun lifetime_earnings<T>(v: &DeveloperVault<T>): u64 { v.lifetime_earnings_atomic }

public fun lifetime_claimed<T>(v: &DeveloperVault<T>): u64 { v.lifetime_claimed_atomic }

public fun auto_claim_threshold<T>(v: &DeveloperVault<T>): u64 { v.auto_claim_threshold_atomic }

// ─── Test helpers ───────────────────────────────────────────────────────────

#[test_only]
public fun new_for_testing<T>(owner: address, ctx: &mut TxContext): DeveloperVault<T> {
    DeveloperVault<T> {
        id: object::new(ctx),
        owner,
        accrued_balance: balance::zero<T>(),
        lifetime_earnings_atomic: 0,
        lifetime_claimed_atomic: 0,
        auto_claim_threshold_atomic: 0,
    }
}

#[test_only]
public fun destroy_for_testing<T>(v: DeveloperVault<T>) {
    let DeveloperVault { id, accrued_balance, .. } = v;
    balance::destroy_for_testing(accrued_balance);
    object::delete(id);
}

#[test_only]
public fun accrue_for_testing<T>(vault: &mut DeveloperVault<T>, payment: Balance<T>) {
    accrue(vault, payment);
}
