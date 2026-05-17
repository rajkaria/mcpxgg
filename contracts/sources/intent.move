/// MCPX agent spending intent — Tier-A feature A1, expanded in Sprint 6.
///
/// A user delegates a budget to an agent address. The agent can then settle
/// calls (within scope, daily cap, expiry) without the user signing each
/// time. Sprint 1 ships the type + create/revoke; the gateway integration
/// (intent-aware settle) lands in Sprint 6.
module mcpx::intent;

use mcpx::events;
use sui::clock::{Self, Clock};

const MS_PER_DAY: u64 = 86_400_000;

const E_NOT_OWNER: u64 = 1;
const E_REVOKED: u64 = 2;
const E_EXPIRED: u64 = 3;
const E_DAILY_CAP: u64 = 4;
const E_SCOPE_MISMATCH: u64 = 5;
const E_INVALID_AGENT: u64 = 6;
const E_PER_CALL_CAP: u64 = 7;

public struct SpendingIntent has key {
    id: UID,
    user: address,
    agent: address,
    daily_cap_atomic: u64,
    per_call_cap_atomic: u64,
    server_ids: vector<ID>,
    allowed_categories: vector<vector<u8>>,
    expires_at_ms: u64,
    today_spent_atomic: u64,
    today_epoch_day: u64,
    lifetime_spent_atomic: u64,
    revoked: bool,
}

public fun create(
    agent: address,
    daily_cap_atomic: u64,
    per_call_cap_atomic: u64,
    server_ids: vector<ID>,
    allowed_categories: vector<vector<u8>>,
    expires_at_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    assert!(agent != @0x0, E_INVALID_AGENT);
    let now = clock::timestamp_ms(clock);
    let intent = SpendingIntent {
        id: object::new(ctx),
        user: ctx.sender(),
        agent,
        daily_cap_atomic,
        per_call_cap_atomic,
        server_ids,
        allowed_categories,
        expires_at_ms,
        today_spent_atomic: 0,
        today_epoch_day: now / MS_PER_DAY,
        lifetime_spent_atomic: 0,
        revoked: false,
    };
    let intent_id = object::id(&intent);
    events::emit_intent_created(
        intent_id,
        ctx.sender(),
        agent,
        daily_cap_atomic,
        per_call_cap_atomic,
        expires_at_ms,
    );
    transfer::share_object(intent);
    intent_id
}

public fun revoke(intent: &mut SpendingIntent, clock: &Clock, ctx: &TxContext) {
    assert!(intent.user == ctx.sender(), E_NOT_OWNER);
    intent.revoked = true;
    events::emit_intent_revoked(object::id(intent), clock::timestamp_ms(clock));
}

/// Reserved for Sprint 6 — settlement integration. Asserts policy and
/// records spend. The actual money movement still flows through
/// `settlement::settle_call`; this is a hook the gateway will call in S6.
public(package) fun record_spend(
    intent: &mut SpendingIntent,
    server_id: ID,
    amount_atomic: u64,
    receipt_id: ID,
    category: vector<u8>,
    clock: &Clock,
) {
    assert!(!intent.revoked, E_REVOKED);
    if (intent.expires_at_ms > 0) {
        assert!(clock::timestamp_ms(clock) < intent.expires_at_ms, E_EXPIRED);
    };
    if (intent.per_call_cap_atomic > 0) {
        assert!(amount_atomic <= intent.per_call_cap_atomic, E_PER_CALL_CAP);
    };
    if (!vector::is_empty(&intent.server_ids)) {
        assert!(vector::contains(&intent.server_ids, &server_id), E_SCOPE_MISMATCH);
    };
    if (!vector::is_empty(&intent.allowed_categories)) {
        assert!(vector::contains(&intent.allowed_categories, &category), E_SCOPE_MISMATCH);
    };
    let today = clock::timestamp_ms(clock) / MS_PER_DAY;
    if (today != intent.today_epoch_day) {
        intent.today_epoch_day = today;
        intent.today_spent_atomic = 0;
    };
    let new_spent = intent.today_spent_atomic + amount_atomic;
    if (intent.daily_cap_atomic > 0) {
        assert!(new_spent <= intent.daily_cap_atomic, E_DAILY_CAP);
    };
    intent.today_spent_atomic = new_spent;
    intent.lifetime_spent_atomic = intent.lifetime_spent_atomic + amount_atomic;
    events::emit_intent_used(object::id(intent), receipt_id, amount_atomic);
}

// ─── Read accessors ─────────────────────────────────────────────────────────

public fun user(i: &SpendingIntent): address { i.user }

public fun agent(i: &SpendingIntent): address { i.agent }

public fun daily_cap(i: &SpendingIntent): u64 { i.daily_cap_atomic }

public fun per_call_cap(i: &SpendingIntent): u64 { i.per_call_cap_atomic }

public fun allowed_categories(i: &SpendingIntent): &vector<vector<u8>> { &i.allowed_categories }

public fun today_spent(i: &SpendingIntent): u64 { i.today_spent_atomic }

public fun lifetime_spent(i: &SpendingIntent): u64 { i.lifetime_spent_atomic }

public fun is_revoked(i: &SpendingIntent): bool { i.revoked }

public fun expires_at_ms(i: &SpendingIntent): u64 { i.expires_at_ms }

public fun server_ids(i: &SpendingIntent): &vector<ID> { &i.server_ids }
