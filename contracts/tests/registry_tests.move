#[test_only]
module mcpx::registry_tests;

use mcpx::registry::{Self, NamespaceRegistry, Server, ServerOwnerCap};
use sui::clock;
use sui::test_scenario as ts;

const ALICE: address = @0xA1;

fun publish_default(
    sc: &mut ts::Scenario,
    registry: &mut NamespaceRegistry,
    namespace: vector<u8>,
    clk: &clock::Clock,
): ServerOwnerCap {
    registry::publish_server(
        registry,
        namespace,
        b"https://walrus-search.mcpx.gg",
        b"walrus-meta-blob-1",
        b"search",
        clk,
        sc.ctx(),
    )
}

#[test]
fun publish_creates_shared_server_and_returns_cap() {
    let mut sc = ts::begin(ALICE);
    let mut registry = registry::new_registry_for_testing(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());

    let cap = publish_default(&mut sc, &mut registry, b"walrus-search", &clk);
    assert!(registry::server_count(&registry) == 1, 0);
    assert!(registry::namespace_taken(&registry, b"walrus-search"), 1);

    sc.next_tx(ALICE);
    {
        let server = sc.take_shared<Server>();
        assert!(registry::owner(&server) == ALICE, 2);
        assert!(registry::is_active(&server), 3);
        assert!(registry::version(&server) == 1, 4);
        assert!(registry::tool_count(&server) == 0, 5);
        assert!(registry::namespace_bytes(&server) == b"walrus-search", 6);
        assert!(registry::cap_server_id(&cap) == object::id(&server), 7);
        ts::return_shared(server);
    };

    clock::destroy_for_testing(clk);
    registry::destroy_cap_for_testing(cap);
    registry::destroy_registry_for_testing(registry);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::registry::E_NAMESPACE_TAKEN)]
fun duplicate_namespace_aborts() {
    let mut sc = ts::begin(ALICE);
    let mut registry = registry::new_registry_for_testing(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());

    let cap1 = publish_default(&mut sc, &mut registry, b"dup-ns", &clk);
    let cap2 = publish_default(&mut sc, &mut registry, b"dup-ns", &clk);

    clock::destroy_for_testing(clk);
    registry::destroy_cap_for_testing(cap1);
    registry::destroy_cap_for_testing(cap2);
    registry::destroy_registry_for_testing(registry);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::registry::E_NAMESPACE_EMPTY)]
fun empty_namespace_aborts() {
    let mut sc = ts::begin(ALICE);
    let mut registry = registry::new_registry_for_testing(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());

    let cap = publish_default(&mut sc, &mut registry, b"", &clk);

    clock::destroy_for_testing(clk);
    registry::destroy_cap_for_testing(cap);
    registry::destroy_registry_for_testing(registry);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::registry::E_INVALID_NAMESPACE_CHAR)]
fun namespace_with_uppercase_aborts() {
    let mut sc = ts::begin(ALICE);
    let mut registry = registry::new_registry_for_testing(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());

    let cap = publish_default(&mut sc, &mut registry, b"Walrus-Search", &clk);

    clock::destroy_for_testing(clk);
    registry::destroy_cap_for_testing(cap);
    registry::destroy_registry_for_testing(registry);
    sc.end();
}

#[test]
fun add_remove_tool_round_trip() {
    let mut sc = ts::begin(ALICE);
    let mut registry = registry::new_registry_for_testing(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());
    let cap = publish_default(&mut sc, &mut registry, b"tool-srv", &clk);

    sc.next_tx(ALICE);
    let mut server = sc.take_shared<Server>();
    registry::add_tool(
        &mut server,
        &cap,
        b"search",
        b"semantic search",
        b"schema-blob",
        50_000,
        100,
        30,
        &clk,
    );
    assert!(registry::tool_count(&server) == 1, 0);
    assert!(registry::has_tool(&server, b"search"), 1);
    assert!(registry::tool_price_atomic(&server, b"search") == 50_000, 2);
    assert!(registry::version(&server) == 2, 3);

    registry::update_tool_price(&mut server, &cap, b"search", 75_000, &clk);
    assert!(registry::tool_price_atomic(&server, b"search") == 75_000, 4);

    registry::remove_tool(&mut server, &cap, b"search", &clk);
    assert!(registry::tool_count(&server) == 0, 5);
    assert!(!registry::has_tool(&server, b"search"), 6);
    ts::return_shared(server);

    clock::destroy_for_testing(clk);
    registry::destroy_cap_for_testing(cap);
    registry::destroy_registry_for_testing(registry);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::registry::E_CAP_MISMATCH)]
fun add_tool_with_wrong_cap_aborts() {
    let mut sc = ts::begin(ALICE);
    let mut registry = registry::new_registry_for_testing(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());
    let cap_alice = publish_default(&mut sc, &mut registry, b"alice-ns", &clk);

    sc.next_tx(ALICE);
    let mut alice_server = sc.take_shared<Server>();
    let alice_id = object::id(&alice_server);

    // Mint a cap whose server_id is "alice id but bumped" — guaranteed mismatch.
    let bumped = ts::new_object(&mut sc); // a fresh UID
    let fake_id = object::uid_to_inner(&bumped);
    object::delete(bumped);
    let wrong_cap = registry::mint_fake_cap_for_testing(fake_id, sc.ctx());
    assert!(fake_id != alice_id, 99);

    registry::add_tool(
        &mut alice_server,
        &wrong_cap,
        b"x",
        b"d",
        b"s",
        100,
        0,
        10,
        &clk,
    );

    ts::return_shared(alice_server);
    clock::destroy_for_testing(clk);
    registry::destroy_cap_for_testing(cap_alice);
    registry::destroy_cap_for_testing(wrong_cap);
    registry::destroy_registry_for_testing(registry);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::registry::E_INVALID_PRICE)]
fun add_tool_with_zero_price_aborts() {
    let mut sc = ts::begin(ALICE);
    let mut registry = registry::new_registry_for_testing(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());
    let cap = publish_default(&mut sc, &mut registry, b"zero-price", &clk);

    sc.next_tx(ALICE);
    let mut server = sc.take_shared<Server>();
    registry::add_tool(&mut server, &cap, b"t", b"d", b"s", 0, 0, 10, &clk);

    ts::return_shared(server);
    clock::destroy_for_testing(clk);
    registry::destroy_cap_for_testing(cap);
    registry::destroy_registry_for_testing(registry);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::registry::E_TOOL_ALREADY_EXISTS)]
fun add_duplicate_tool_aborts() {
    let mut sc = ts::begin(ALICE);
    let mut registry = registry::new_registry_for_testing(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());
    let cap = publish_default(&mut sc, &mut registry, b"dup-tool", &clk);

    sc.next_tx(ALICE);
    let mut server = sc.take_shared<Server>();
    registry::add_tool(&mut server, &cap, b"x", b"d", b"s", 100, 0, 10, &clk);
    registry::add_tool(&mut server, &cap, b"x", b"d2", b"s2", 200, 0, 10, &clk);

    ts::return_shared(server);
    clock::destroy_for_testing(clk);
    registry::destroy_cap_for_testing(cap);
    registry::destroy_registry_for_testing(registry);
    sc.end();
}

#[test]
fun deactivate_frees_namespace() {
    let mut sc = ts::begin(ALICE);
    let mut registry = registry::new_registry_for_testing(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());
    let cap = publish_default(&mut sc, &mut registry, b"reusable", &clk);

    sc.next_tx(ALICE);
    {
        let mut server = sc.take_shared<Server>();
        registry::deactivate(&mut server, &cap, &mut registry, &clk);
        assert!(!registry::is_active(&server), 0);
        assert!(!registry::namespace_taken(&registry, b"reusable"), 1);
        assert!(registry::server_count(&registry) == 0, 2);
        ts::return_shared(server);
    };

    let cap2 = publish_default(&mut sc, &mut registry, b"reusable", &clk);
    assert!(registry::server_count(&registry) == 1, 3);

    clock::destroy_for_testing(clk);
    registry::destroy_cap_for_testing(cap);
    registry::destroy_cap_for_testing(cap2);
    registry::destroy_registry_for_testing(registry);
    sc.end();
}

#[test]
fun update_metadata_bumps_version() {
    let mut sc = ts::begin(ALICE);
    let mut registry = registry::new_registry_for_testing(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());
    let cap = publish_default(&mut sc, &mut registry, b"meta-srv", &clk);

    sc.next_tx(ALICE);
    let mut server = sc.take_shared<Server>();
    registry::update_metadata(&mut server, &cap, b"https://new.example", b"new-meta", &clk);
    assert!(registry::version(&server) == 2, 0);
    assert!(*registry::endpoint_url(&server) == b"https://new.example", 1);
    ts::return_shared(server);

    clock::destroy_for_testing(clk);
    registry::destroy_cap_for_testing(cap);
    registry::destroy_registry_for_testing(registry);
    sc.end();
}
