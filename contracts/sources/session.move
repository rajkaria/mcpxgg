/// MCPX user session — pre-funded escrow that the settlement module debits
/// per call. Sessions are shared so the gateway/facilitator can include them
/// in a settlement PTB without owning a reference; user-only operations
/// (deposit, withdraw, close) are gated by `ctx.sender() == session.owner`.
///
/// Caps:
///   - `per_call_cap_atomic == 0` → unlimited per call
///   - `per_day_cap_atomic == 0`  → unlimited per day
///   - `expires_at_ms == 0`       → no expiry
///   - `scoped_server_ids` empty  → can spend on any server
///
/// Day windows are based on `clock::timestamp_ms / 86_400_000`, so they roll
/// over at UTC midnight of the *gateway-observed* clock. Good enough for
/// rate-limiting; not fiscal precision.
module mcpx::session;

use mcpx::events;
use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};

// ─── Errors ─────────────────────────────────────────────────────────────────

const E_NOT_OWNER: u64 = 1;
const E_INACTIVE: u64 = 2;
const E_EXPIRED: u64 = 3;
const E_INSUFFICIENT_BALANCE: u64 = 4;
const E_PER_CALL_CAP: u64 = 5;
const E_PER_DAY_CAP: u64 = 6;
const E_SCOPE_MISMATCH: u64 = 7;
const E_ZERO_DEPOSIT: u64 = 8;

// ─── Constants ──────────────────────────────────────────────────────────────

const MS_PER_DAY: u64 = 86_400_000;

// ─── Structs ────────────────────────────────────────────────────────────────

public struct Session<phantom T> has key {
    id: UID,
    owner: address,
    balance: Balance<T>,
    per_call_cap_atomic: u64,
    per_day_cap_atomic: u64,
    today_spent_atomic: u64,
    today_epoch_day: u64,
    scoped_server_ids: vector<ID>,
    expires_at_ms: u64,
    active: bool,
    lifetime_deposited_atomic: u64,
    lifetime_spent_atomic: u64,
}

/// Capability granted to whoever should be able to authorize off-chain calls
/// on behalf of the session. Sprint 4 wires this to API key derivation.
public struct SessionKey has key, store {
    id: UID,
    session_id: ID,
}

// ─── Create ─────────────────────────────────────────────────────────────────

public fun create<T>(
    initial_deposit: Coin<T>,
    per_call_cap_atomic: u64,
    per_day_cap_atomic: u64,
    scoped_server_ids: vector<ID>,
    expires_at_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): SessionKey {
    let initial = coin::value(&initial_deposit);
    assert!(initial > 0, E_ZERO_DEPOSIT);
    let now = clock::timestamp_ms(clock);
    let owner = ctx.sender();

    let session = Session<T> {
        id: object::new(ctx),
        owner,
        balance: coin::into_balance(initial_deposit),
        per_call_cap_atomic,
        per_day_cap_atomic,
        today_spent_atomic: 0,
        today_epoch_day: now / MS_PER_DAY,
        scoped_server_ids,
        expires_at_ms,
        active: true,
        lifetime_deposited_atomic: initial,
        lifetime_spent_atomic: 0,
    };
    let session_id = object::id(&session);
    let key = SessionKey { id: object::new(ctx), session_id };

    events::emit_session_created(session_id, owner, initial, now);

    transfer::share_object(session);
    key
}

// ─── Owner ops ──────────────────────────────────────────────────────────────

public fun deposit<T>(
    session: &mut Session<T>,
    coin: Coin<T>,
    ctx: &TxContext,
) {
    assert!(session.owner == ctx.sender(), E_NOT_OWNER);
    assert!(session.active, E_INACTIVE);
    let amount = coin::value(&coin);
    assert!(amount > 0, E_ZERO_DEPOSIT);
    balance::join(&mut session.balance, coin::into_balance(coin));
    session.lifetime_deposited_atomic = session.lifetime_deposited_atomic + amount;
    events::emit_session_deposit(
        object::id(session),
        amount,
        balance::value(&session.balance),
    );
}

public fun withdraw<T>(
    session: &mut Session<T>,
    amount: u64,
    ctx: &mut TxContext,
) {
    assert!(session.owner == ctx.sender(), E_NOT_OWNER);
    assert!(balance::value(&session.balance) >= amount, E_INSUFFICIENT_BALANCE);
    let coin = coin::from_balance(balance::split(&mut session.balance, amount), ctx);
    events::emit_session_withdraw(
        object::id(session),
        amount,
        balance::value(&session.balance),
    );
    transfer::public_transfer(coin, session.owner);
}

public fun update_limits<T>(
    session: &mut Session<T>,
    per_call_cap_atomic: u64,
    per_day_cap_atomic: u64,
    ctx: &TxContext,
) {
    assert!(session.owner == ctx.sender(), E_NOT_OWNER);
    session.per_call_cap_atomic = per_call_cap_atomic;
    session.per_day_cap_atomic = per_day_cap_atomic;
    events::emit_session_limits_updated(
        object::id(session),
        per_call_cap_atomic,
        per_day_cap_atomic,
    );
}

public fun update_scope<T>(
    session: &mut Session<T>,
    scoped_server_ids: vector<ID>,
    ctx: &TxContext,
) {
    assert!(session.owner == ctx.sender(), E_NOT_OWNER);
    session.scoped_server_ids = scoped_server_ids;
}

/// Close the session — refunds remaining balance and disables further use.
public fun close<T>(session: &mut Session<T>, ctx: &mut TxContext) {
    assert!(session.owner == ctx.sender(), E_NOT_OWNER);
    assert!(session.active, E_INACTIVE);
    let amount = balance::value(&session.balance);
    if (amount > 0) {
        let refund = coin::from_balance(balance::withdraw_all(&mut session.balance), ctx);
        transfer::public_transfer(refund, session.owner);
    };
    session.active = false;
    events::emit_session_closed(object::id(session), amount);
}

// ─── Internal: settlement-only debit ────────────────────────────────────────

/// Splits `amount` out of the session balance and returns it to the caller
/// (the settlement module). Enforces all the session's active policies.
public(package) fun debit<T>(
    session: &mut Session<T>,
    amount: u64,
    server_id: ID,
    clock: &Clock,
): Balance<T> {
    assert!(session.active, E_INACTIVE);

    // Expiry
    if (session.expires_at_ms > 0) {
        assert!(clock::timestamp_ms(clock) < session.expires_at_ms, E_EXPIRED);
    };

    // Per-call cap
    if (session.per_call_cap_atomic > 0) {
        assert!(amount <= session.per_call_cap_atomic, E_PER_CALL_CAP);
    };

    // Per-day rolling window
    let today = clock::timestamp_ms(clock) / MS_PER_DAY;
    if (today != session.today_epoch_day) {
        session.today_epoch_day = today;
        session.today_spent_atomic = 0;
    };
    if (session.per_day_cap_atomic > 0) {
        let new_spent = session.today_spent_atomic + amount;
        assert!(new_spent <= session.per_day_cap_atomic, E_PER_DAY_CAP);
        session.today_spent_atomic = new_spent;
    } else {
        session.today_spent_atomic = session.today_spent_atomic + amount;
    };

    // Scope
    if (!vector::is_empty(&session.scoped_server_ids)) {
        assert!(vector::contains(&session.scoped_server_ids, &server_id), E_SCOPE_MISMATCH);
    };

    // Balance
    assert!(balance::value(&session.balance) >= amount, E_INSUFFICIENT_BALANCE);
    session.lifetime_spent_atomic = session.lifetime_spent_atomic + amount;
    balance::split(&mut session.balance, amount)
}

/// Refund path — settlement module returns funds on a failed call.
public(package) fun credit<T>(session: &mut Session<T>, refund: Balance<T>) {
    let amount = balance::value(&refund);
    balance::join(&mut session.balance, refund);
    if (session.lifetime_spent_atomic >= amount) {
        session.lifetime_spent_atomic = session.lifetime_spent_atomic - amount;
    };
    if (session.today_spent_atomic >= amount) {
        session.today_spent_atomic = session.today_spent_atomic - amount;
    };
}

// ─── Read accessors ─────────────────────────────────────────────────────────

public fun owner<T>(s: &Session<T>): address { s.owner }

public fun balance_value<T>(s: &Session<T>): u64 { balance::value(&s.balance) }

public fun per_call_cap_atomic<T>(s: &Session<T>): u64 { s.per_call_cap_atomic }

public fun per_day_cap_atomic<T>(s: &Session<T>): u64 { s.per_day_cap_atomic }

public fun today_spent_atomic<T>(s: &Session<T>): u64 { s.today_spent_atomic }

public fun lifetime_deposited<T>(s: &Session<T>): u64 { s.lifetime_deposited_atomic }

public fun lifetime_spent<T>(s: &Session<T>): u64 { s.lifetime_spent_atomic }

public fun is_active<T>(s: &Session<T>): bool { s.active }

public fun expires_at_ms<T>(s: &Session<T>): u64 { s.expires_at_ms }

public fun scoped_server_ids<T>(s: &Session<T>): &vector<ID> { &s.scoped_server_ids }

public fun key_session_id(k: &SessionKey): ID { k.session_id }

// ─── Test helpers ───────────────────────────────────────────────────────────

#[test_only]
public fun new_for_testing<T>(
    owner: address,
    initial: Balance<T>,
    per_call_cap: u64,
    per_day_cap: u64,
    scoped: vector<ID>,
    expires_at_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): Session<T> {
    let now = clock::timestamp_ms(clock);
    let initial_amount = balance::value(&initial);
    Session<T> {
        id: object::new(ctx),
        owner,
        balance: initial,
        per_call_cap_atomic: per_call_cap,
        per_day_cap_atomic: per_day_cap,
        today_spent_atomic: 0,
        today_epoch_day: now / MS_PER_DAY,
        scoped_server_ids: scoped,
        expires_at_ms,
        active: true,
        lifetime_deposited_atomic: initial_amount,
        lifetime_spent_atomic: 0,
    }
}

#[test_only]
public fun destroy_for_testing<T>(s: Session<T>) {
    let Session { id, balance, .. } = s;
    balance::destroy_for_testing(balance);
    object::delete(id);
}

#[test_only]
public fun debit_for_testing<T>(
    session: &mut Session<T>,
    amount: u64,
    server_id: ID,
    clock: &Clock,
): Balance<T> {
    debit(session, amount, server_id, clock)
}

#[test_only]
public fun destroy_key_for_testing(k: SessionKey) {
    let SessionKey { id, .. } = k;
    object::delete(id);
}
