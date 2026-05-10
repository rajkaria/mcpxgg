/// MCPX composable server bundles — Tier-A feature A5, expanded in Sprint 5.
///
/// A `Bundle` is a curated list of server IDs with a per-call price multiplier.
/// Activation is currently a no-op; Sprint 5 wires bundle-aware settlement
/// (per-server discount via the multiplier) and bundle-scoped session keys.
module mcpx::bundle;

use mcpx::events;
use sui::clock::{Self, Clock};

const E_NOT_OWNER: u64 = 1;
const E_NO_SERVERS: u64 = 2;
const E_INVALID_MULTIPLIER: u64 = 3;
const E_TOO_MANY_SERVERS: u64 = 4;

const MAX_SERVERS_PER_BUNDLE: u64 = 50;

public struct Bundle has key {
    id: UID,
    name: vector<u8>,
    creator: address,
    server_ids: vector<ID>,
    /// Multiplier × 100 (e.g. 90 = 0.9× = 10% discount).
    price_multiplier_x100: u32,
    metadata_blob_id: vector<u8>,
    active: bool,
    created_at_ms: u64,
}

public fun create(
    name: vector<u8>,
    server_ids: vector<ID>,
    price_multiplier_x100: u32,
    metadata_blob_id: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    let count = vector::length(&server_ids);
    assert!(count > 0, E_NO_SERVERS);
    assert!(count <= MAX_SERVERS_PER_BUNDLE, E_TOO_MANY_SERVERS);
    assert!(price_multiplier_x100 > 0 && price_multiplier_x100 <= 1_000, E_INVALID_MULTIPLIER);

    let bundle = Bundle {
        id: object::new(ctx),
        name,
        creator: ctx.sender(),
        server_ids,
        price_multiplier_x100,
        metadata_blob_id,
        active: true,
        created_at_ms: clock::timestamp_ms(clock),
    };
    let bundle_id = object::id(&bundle);
    events::emit_bundle_created(bundle_id, ctx.sender(), count, price_multiplier_x100);
    transfer::share_object(bundle);
    bundle_id
}

public fun deactivate(bundle: &mut Bundle, ctx: &TxContext) {
    assert!(bundle.creator == ctx.sender(), E_NOT_OWNER);
    bundle.active = false;
}

public fun activate_for_user(bundle: &Bundle, clock: &Clock, ctx: &TxContext) {
    events::emit_bundle_activated(object::id(bundle), ctx.sender(), clock::timestamp_ms(clock));
}

// ─── Read accessors ─────────────────────────────────────────────────────────

public fun name(b: &Bundle): &vector<u8> { &b.name }

public fun creator(b: &Bundle): address { b.creator }

public fun server_ids(b: &Bundle): &vector<ID> { &b.server_ids }

public fun price_multiplier_x100(b: &Bundle): u32 { b.price_multiplier_x100 }

public fun is_active(b: &Bundle): bool { b.active }

public fun server_count(b: &Bundle): u64 { vector::length(&b.server_ids) }
