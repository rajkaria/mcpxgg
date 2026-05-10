/// MCPX server registry — the canonical on-chain catalog of MCP servers.
///
/// Each server is a shared object so the gateway can read pricing without
/// owning a reference. Mutations require the matching `ServerOwnerCap`,
/// which is transferred to the publisher at creation time.
///
/// Namespaces (e.g. "walrus-search") are unique per-chain and live in the
/// shared `NamespaceRegistry` table — `publish_server` aborts if the
/// namespace is already taken.
module mcpx::registry;

use mcpx::events;
use std::string::{Self, String};
use sui::clock::{Self, Clock};
use sui::table::{Self, Table};

// ─── Errors ─────────────────────────────────────────────────────────────────

const E_NAMESPACE_TAKEN: u64 = 1;
const E_NAMESPACE_EMPTY: u64 = 2;
const E_NAMESPACE_TOO_LONG: u64 = 3;
const E_INVALID_NAMESPACE_CHAR: u64 = 4;
const E_CAP_MISMATCH: u64 = 5;
const E_INACTIVE: u64 = 6;
const E_TOOL_NOT_FOUND: u64 = 7;
const E_TOOL_ALREADY_EXISTS: u64 = 8;
const E_INVALID_PRICE: u64 = 9;
const E_TOO_MANY_TOOLS: u64 = 10;

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_NAMESPACE_LEN: u64 = 64;
const MAX_TOOLS_PER_SERVER: u64 = 100;

// ─── Structs ────────────────────────────────────────────────────────────────

public struct Tool has copy, drop, store {
    name: String,
    description: vector<u8>,
    input_schema_blob_id: vector<u8>,
    price_atomic: u64,
    free_tier_calls_per_user: u64,
    timeout_seconds: u32,
}

public struct Server has key {
    id: UID,
    namespace: String,
    owner: address,
    endpoint_url: vector<u8>,
    metadata_blob_id: vector<u8>,
    category: vector<u8>,
    tools: vector<Tool>,
    active: bool,
    version: u64,
    created_at_ms: u64,
    updated_at_ms: u64,
}

public struct ServerOwnerCap has key, store {
    id: UID,
    server_id: ID,
}

public struct NamespaceRegistry has key {
    id: UID,
    /// namespace bytes → server id
    entries: Table<vector<u8>, ID>,
    server_count: u64,
}

// ─── Init ───────────────────────────────────────────────────────────────────

fun init(ctx: &mut TxContext) {
    let registry = NamespaceRegistry {
        id: object::new(ctx),
        entries: table::new(ctx),
        server_count: 0,
    };
    transfer::share_object(registry);
}

// ─── Publish / update ───────────────────────────────────────────────────────

/// Publishes a new server with no tools. Tools are added via `add_tool` —
/// callable in the same PTB as `publish_server`, so the SDK can express
/// "publish + add 3 tools" atomically.
public fun publish_server(
    registry: &mut NamespaceRegistry,
    namespace_bytes: vector<u8>,
    endpoint_url: vector<u8>,
    metadata_blob_id: vector<u8>,
    category: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
): ServerOwnerCap {
    assert_valid_namespace(&namespace_bytes);
    assert!(!table::contains(&registry.entries, namespace_bytes), E_NAMESPACE_TAKEN);

    let now = clock::timestamp_ms(clock);
    let owner = ctx.sender();
    let namespace = string::utf8(namespace_bytes);

    let server = Server {
        id: object::new(ctx),
        namespace,
        owner,
        endpoint_url,
        metadata_blob_id,
        category,
        tools: vector[],
        active: true,
        version: 1,
        created_at_ms: now,
        updated_at_ms: now,
    };
    let server_id = object::id(&server);

    let cap = ServerOwnerCap {
        id: object::new(ctx),
        server_id,
    };

    table::add(&mut registry.entries, *string::as_bytes(&server.namespace), server_id);
    registry.server_count = registry.server_count + 1;

    events::emit_server_published(
        server_id,
        *string::as_bytes(&server.namespace),
        owner,
        server.metadata_blob_id,
        server.category,
        now,
    );

    transfer::share_object(server);
    cap
}

public fun update_metadata(
    server: &mut Server,
    cap: &ServerOwnerCap,
    new_endpoint_url: vector<u8>,
    new_metadata_blob_id: vector<u8>,
    clock: &Clock,
) {
    assert_cap_matches(cap, server);
    assert!(server.active, E_INACTIVE);
    server.endpoint_url = new_endpoint_url;
    server.metadata_blob_id = new_metadata_blob_id;
    server.version = server.version + 1;
    server.updated_at_ms = clock::timestamp_ms(clock);
    events::emit_server_updated(object::id(server), server.version, server.updated_at_ms);
}

public fun add_tool(
    server: &mut Server,
    cap: &ServerOwnerCap,
    name_bytes: vector<u8>,
    description: vector<u8>,
    input_schema_blob_id: vector<u8>,
    price_atomic: u64,
    free_tier_calls_per_user: u64,
    timeout_seconds: u32,
    clock: &Clock,
) {
    assert_cap_matches(cap, server);
    assert!(server.active, E_INACTIVE);
    assert!(price_atomic > 0, E_INVALID_PRICE);
    assert!(vector::length(&server.tools) < MAX_TOOLS_PER_SERVER, E_TOO_MANY_TOOLS);

    let name = string::utf8(name_bytes);
    assert!(find_tool_index(&server.tools, &name).is_none(), E_TOOL_ALREADY_EXISTS);

    let name_for_event = *string::as_bytes(&name);
    let tool = Tool {
        name,
        description,
        input_schema_blob_id,
        price_atomic,
        free_tier_calls_per_user,
        timeout_seconds,
    };
    vector::push_back(&mut server.tools, tool);
    server.version = server.version + 1;
    server.updated_at_ms = clock::timestamp_ms(clock);

    events::emit_tool_added(object::id(server), name_for_event, price_atomic);
    events::emit_server_updated(object::id(server), server.version, server.updated_at_ms);
}

public fun remove_tool(
    server: &mut Server,
    cap: &ServerOwnerCap,
    name_bytes: vector<u8>,
    clock: &Clock,
) {
    assert_cap_matches(cap, server);
    let name = string::utf8(name_bytes);
    let idx_opt = find_tool_index(&server.tools, &name);
    assert!(idx_opt.is_some(), E_TOOL_NOT_FOUND);
    let idx = idx_opt.destroy_some();

    let removed = vector::remove(&mut server.tools, idx);
    let Tool { name: removed_name, .. } = removed;
    let removed_bytes = *string::as_bytes(&removed_name);

    server.version = server.version + 1;
    server.updated_at_ms = clock::timestamp_ms(clock);

    events::emit_tool_removed(object::id(server), removed_bytes);
    events::emit_server_updated(object::id(server), server.version, server.updated_at_ms);
}

public fun update_tool_price(
    server: &mut Server,
    cap: &ServerOwnerCap,
    name_bytes: vector<u8>,
    new_price_atomic: u64,
    clock: &Clock,
) {
    assert_cap_matches(cap, server);
    assert!(server.active, E_INACTIVE);
    assert!(new_price_atomic > 0, E_INVALID_PRICE);
    let name = string::utf8(name_bytes);
    let idx_opt = find_tool_index(&server.tools, &name);
    assert!(idx_opt.is_some(), E_TOOL_NOT_FOUND);
    let idx = idx_opt.destroy_some();
    let tool_ref = vector::borrow_mut(&mut server.tools, idx);
    tool_ref.price_atomic = new_price_atomic;
    server.version = server.version + 1;
    server.updated_at_ms = clock::timestamp_ms(clock);
    events::emit_server_updated(object::id(server), server.version, server.updated_at_ms);
}

public fun deactivate(
    server: &mut Server,
    cap: &ServerOwnerCap,
    registry: &mut NamespaceRegistry,
    clock: &Clock,
) {
    assert_cap_matches(cap, server);
    server.active = false;
    server.version = server.version + 1;
    server.updated_at_ms = clock::timestamp_ms(clock);
    let ns_bytes = *string::as_bytes(&server.namespace);
    if (table::contains(&registry.entries, ns_bytes)) {
        table::remove(&mut registry.entries, ns_bytes);
        registry.server_count = registry.server_count - 1;
    };
    events::emit_server_deactivated(object::id(server), server.updated_at_ms);
}

// ─── Read accessors ─────────────────────────────────────────────────────────

public fun owner(s: &Server): address { s.owner }

public fun namespace(s: &Server): &String { &s.namespace }

public fun namespace_bytes(s: &Server): vector<u8> { *string::as_bytes(&s.namespace) }

public fun endpoint_url(s: &Server): &vector<u8> { &s.endpoint_url }

public fun is_active(s: &Server): bool { s.active }

public fun version(s: &Server): u64 { s.version }

public fun tool_count(s: &Server): u64 { vector::length(&s.tools) }

public fun has_tool(s: &Server, name_bytes: vector<u8>): bool {
    find_tool_index(&s.tools, &string::utf8(name_bytes)).is_some()
}

public fun tool_price_atomic(s: &Server, name_bytes: vector<u8>): u64 {
    let name = string::utf8(name_bytes);
    let idx_opt = find_tool_index(&s.tools, &name);
    assert!(idx_opt.is_some(), E_TOOL_NOT_FOUND);
    let idx = idx_opt.destroy_some();
    vector::borrow(&s.tools, idx).price_atomic
}

public fun cap_server_id(c: &ServerOwnerCap): ID { c.server_id }

public fun server_count(r: &NamespaceRegistry): u64 { r.server_count }

public fun namespace_taken(r: &NamespaceRegistry, namespace_bytes: vector<u8>): bool {
    table::contains(&r.entries, namespace_bytes)
}

public fun namespace_server_id(r: &NamespaceRegistry, namespace_bytes: vector<u8>): ID {
    *table::borrow(&r.entries, namespace_bytes)
}

// ─── Internal helpers ───────────────────────────────────────────────────────

fun assert_cap_matches(cap: &ServerOwnerCap, server: &Server) {
    assert!(cap.server_id == object::id(server), E_CAP_MISMATCH);
}

fun assert_valid_namespace(bytes: &vector<u8>) {
    let len = vector::length(bytes);
    assert!(len > 0, E_NAMESPACE_EMPTY);
    assert!(len <= MAX_NAMESPACE_LEN, E_NAMESPACE_TOO_LONG);
    let mut i = 0;
    while (i < len) {
        let b = *vector::borrow(bytes, i);
        // Allow lowercase a-z, digits 0-9, hyphen, underscore. UTF-8 enforced
        // by string::utf8 separately, but we lock down namespace strictly.
        let ok = (b >= 0x61 && b <= 0x7A) // a-z
            || (b >= 0x30 && b <= 0x39) // 0-9
            || b == 0x2D // -
            || b == 0x5F; // _
        assert!(ok, E_INVALID_NAMESPACE_CHAR);
        i = i + 1;
    };
}

fun find_tool_index(tools: &vector<Tool>, name: &String): Option<u64> {
    let len = vector::length(tools);
    let mut i = 0;
    while (i < len) {
        if (&vector::borrow(tools, i).name == name) {
            return option::some(i)
        };
        i = i + 1;
    };
    option::none()
}

// ─── Test helpers ───────────────────────────────────────────────────────────

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

#[test_only]
public fun new_registry_for_testing(ctx: &mut TxContext): NamespaceRegistry {
    NamespaceRegistry {
        id: object::new(ctx),
        entries: table::new(ctx),
        server_count: 0,
    }
}

#[test_only]
public fun destroy_registry_for_testing(r: NamespaceRegistry) {
    let NamespaceRegistry { id, entries, .. } = r;
    table::drop(entries);
    object::delete(id);
}

#[test_only]
public fun destroy_cap_for_testing(c: ServerOwnerCap) {
    let ServerOwnerCap { id, .. } = c;
    object::delete(id);
}

#[test_only]
public fun max_tools_for_testing(): u64 { MAX_TOOLS_PER_SERVER }

#[test_only]
public fun mint_fake_cap_for_testing(server_id: ID, ctx: &mut TxContext): ServerOwnerCap {
    ServerOwnerCap { id: object::new(ctx), server_id }
}
