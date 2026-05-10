/// MCPX insurance pool — receives 0.5% of every settled call (default; configurable
/// via PlatformConfig). Pays out to users for verified outages or to slashed-stake
/// recipients (Sprint 7 wires staking).
///
/// Two caps exist:
///   - `AdminCap` (from `admin` module) — for top-up / emergency drain
///   - `InsurancePayerCap` — minted by the admin to one or more oracle addresses;
///     these can authorize routine outage payouts without admin sign-off.
module mcpx::insurance;

use mcpx::admin::AdminCap;
use mcpx::events;
use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};

const E_INSUFFICIENT_BALANCE: u64 = 1;

public struct InsurancePool<phantom T> has key {
    id: UID,
    balance: Balance<T>,
    lifetime_collected_atomic: u64,
    lifetime_paid_atomic: u64,
}

/// Authority to authorize routine insurance payouts. Held by oracle service(s).
public struct InsurancePayerCap has key, store {
    id: UID,
}

public fun initialize<T>(_: &AdminCap, ctx: &mut TxContext) {
    let pool = InsurancePool<T> {
        id: object::new(ctx),
        balance: balance::zero<T>(),
        lifetime_collected_atomic: 0,
        lifetime_paid_atomic: 0,
    };
    transfer::share_object(pool);
}

public fun mint_payer_cap(_: &AdminCap, recipient: address, ctx: &mut TxContext) {
    let cap = InsurancePayerCap { id: object::new(ctx) };
    transfer::transfer(cap, recipient);
}

/// Internal: called only by `settlement::settle_call` to skim the insurance share.
public(package) fun collect<T>(pool: &mut InsurancePool<T>, fee: Balance<T>) {
    let amount = balance::value(&fee);
    balance::join(&mut pool.balance, fee);
    pool.lifetime_collected_atomic = pool.lifetime_collected_atomic + amount;
    events::emit_insurance_collected(amount, pool.lifetime_collected_atomic);
}

/// Manual top-up — anyone can donate.
public fun top_up<T>(pool: &mut InsurancePool<T>, contribution: Coin<T>) {
    let amount = coin::value(&contribution);
    balance::join(&mut pool.balance, coin::into_balance(contribution));
    pool.lifetime_collected_atomic = pool.lifetime_collected_atomic + amount;
    events::emit_insurance_collected(amount, pool.lifetime_collected_atomic);
}

/// Pay out to a user. Routine path — gated by InsurancePayerCap (oracle / multisig).
public fun pay_out<T>(
    _: &InsurancePayerCap,
    pool: &mut InsurancePool<T>,
    amount: u64,
    recipient: address,
    reason: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(balance::value(&pool.balance) >= amount, E_INSUFFICIENT_BALANCE);
    let payment = coin::from_balance(balance::split(&mut pool.balance, amount), ctx);
    pool.lifetime_paid_atomic = pool.lifetime_paid_atomic + amount;
    events::emit_insurance_paid(amount, recipient, reason, clock::timestamp_ms(clock));
    transfer::public_transfer(payment, recipient);
}

/// Emergency drain — admin-cap gated. For migration or wind-down only.
public fun admin_withdraw<T>(
    _: &AdminCap,
    pool: &mut InsurancePool<T>,
    amount: u64,
    recipient: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(balance::value(&pool.balance) >= amount, E_INSUFFICIENT_BALANCE);
    let withdrawn = coin::from_balance(balance::split(&mut pool.balance, amount), ctx);
    pool.lifetime_paid_atomic = pool.lifetime_paid_atomic + amount;
    events::emit_insurance_paid(amount, recipient, b"admin_withdraw", clock::timestamp_ms(clock));
    transfer::public_transfer(withdrawn, recipient);
}

// ─── Read accessors ─────────────────────────────────────────────────────────

public fun balance_value<T>(p: &InsurancePool<T>): u64 {
    balance::value(&p.balance)
}

public fun lifetime_collected<T>(p: &InsurancePool<T>): u64 {
    p.lifetime_collected_atomic
}

public fun lifetime_paid<T>(p: &InsurancePool<T>): u64 {
    p.lifetime_paid_atomic
}

// ─── Test helpers ───────────────────────────────────────────────────────────

#[test_only]
public fun new_for_testing<T>(ctx: &mut TxContext): InsurancePool<T> {
    InsurancePool<T> {
        id: object::new(ctx),
        balance: balance::zero<T>(),
        lifetime_collected_atomic: 0,
        lifetime_paid_atomic: 0,
    }
}

#[test_only]
public fun mint_payer_cap_for_testing(ctx: &mut TxContext): InsurancePayerCap {
    InsurancePayerCap { id: object::new(ctx) }
}

#[test_only]
public fun destroy_payer_cap_for_testing(cap: InsurancePayerCap) {
    let InsurancePayerCap { id } = cap;
    object::delete(id);
}

#[test_only]
public fun destroy_for_testing<T>(p: InsurancePool<T>) {
    let InsurancePool { id, balance, .. } = p;
    balance::destroy_for_testing(balance);
    object::delete(id);
}

#[test_only]
public fun collect_for_testing<T>(pool: &mut InsurancePool<T>, fee: Balance<T>) {
    collect(pool, fee);
}
