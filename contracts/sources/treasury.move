/// MCPX platform treasury — generic over coin type so we can run unit tests
/// with mock coins without needing the real USDsui type tag.
///
/// Receives the treasury share of every settled call (default 200 bps of the
/// 250 bps take rate, per ADR-004). Withdrawals require an `AdminCap` from the
/// `admin` module — this is the same multisig-held cap that mutates
/// `PlatformConfig`, so the take-rate setter and the treasury withdrawer share
/// the same governance boundary.
module mcpx::treasury;

use mcpx::admin::AdminCap;
use mcpx::events;
use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin;

const E_INSUFFICIENT_BALANCE: u64 = 1;

public struct PlatformTreasury<phantom T> has key {
    id: UID,
    balance: Balance<T>,
    lifetime_collected_atomic: u64,
    lifetime_withdrawn_atomic: u64,
}

/// Initialise a per-coin treasury. Called once after deploy by the admin who
/// holds `AdminCap`. We don't call this from `init` because Move's `init` is
/// monomorphic — it can't carry a generic `T`.
public fun initialize<T>(_: &AdminCap, ctx: &mut TxContext) {
    let treasury = PlatformTreasury<T> {
        id: object::new(ctx),
        balance: balance::zero<T>(),
        lifetime_collected_atomic: 0,
        lifetime_withdrawn_atomic: 0,
    };
    transfer::share_object(treasury);
}

/// Internal: called by `settlement::settle_call` only.
public(package) fun collect<T>(treasury: &mut PlatformTreasury<T>, fee: Balance<T>) {
    let amount = balance::value(&fee);
    balance::join(&mut treasury.balance, fee);
    treasury.lifetime_collected_atomic = treasury.lifetime_collected_atomic + amount;
    events::emit_treasury_collected(amount, treasury.lifetime_collected_atomic);
}

public fun withdraw<T>(
    _: &AdminCap,
    treasury: &mut PlatformTreasury<T>,
    amount: u64,
    recipient: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(balance::value(&treasury.balance) >= amount, E_INSUFFICIENT_BALANCE);
    let withdrawn = coin::from_balance(balance::split(&mut treasury.balance, amount), ctx);
    treasury.lifetime_withdrawn_atomic = treasury.lifetime_withdrawn_atomic + amount;
    events::emit_treasury_withdrawn(amount, recipient, clock::timestamp_ms(clock));
    transfer::public_transfer(withdrawn, recipient);
}

// ─── Read accessors ─────────────────────────────────────────────────────────

public fun balance_value<T>(t: &PlatformTreasury<T>): u64 {
    balance::value(&t.balance)
}

public fun lifetime_collected<T>(t: &PlatformTreasury<T>): u64 {
    t.lifetime_collected_atomic
}

public fun lifetime_withdrawn<T>(t: &PlatformTreasury<T>): u64 {
    t.lifetime_withdrawn_atomic
}

// ─── Test helpers ───────────────────────────────────────────────────────────

#[test_only]
public fun new_for_testing<T>(ctx: &mut TxContext): PlatformTreasury<T> {
    PlatformTreasury<T> {
        id: object::new(ctx),
        balance: balance::zero<T>(),
        lifetime_collected_atomic: 0,
        lifetime_withdrawn_atomic: 0,
    }
}

#[test_only]
public fun destroy_for_testing<T>(t: PlatformTreasury<T>) {
    let PlatformTreasury { id, balance, .. } = t;
    balance::destroy_for_testing(balance);
    object::delete(id);
}

#[test_only]
public fun collect_for_testing<T>(treasury: &mut PlatformTreasury<T>, fee: Balance<T>) {
    collect(treasury, fee);
}
