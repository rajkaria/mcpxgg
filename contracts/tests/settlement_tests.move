#[test_only]
module mcpx::settlement_tests;

use mcpx::admin;
use mcpx::insurance;
use mcpx::registry::{Self, NamespaceRegistry, Server, ServerOwnerCap};
use mcpx::session;
use mcpx::settlement::{Self, CallReceipt};
use mcpx::treasury;
use mcpx::vault;
use sui::balance;
use sui::clock;
use sui::sui::SUI;
use sui::test_scenario as ts;

const DEV: address = @0xDEFA;
const USER: address = @0xCAFE;

fun publish_test_server(
    sc: &mut ts::Scenario,
    registry: &mut NamespaceRegistry,
    clk: &clock::Clock,
): ServerOwnerCap {
    let cap = registry::publish_server(
        registry,
        b"test-server",
        b"https://server.example",
        b"meta",
        b"test",
        clk,
        sc.ctx(),
    );
    cap
}

#[test]
fun settle_full_flow_distributes_correctly() {
    // Defaults: take_rate_bps = 250, insurance_bps = 50, treasury_bps = 200.
    // amount = 10_000 → insurance = 50, treasury = 200, dev = 9_750.
    let mut sc = ts::begin(DEV);
    let clk = clock::create_for_testing(sc.ctx());

    // Configs / pools / vault
    let admin_cap = admin::mint_admin_cap_for_testing(sc.ctx());
    let config = admin::new_config_for_testing(sc.ctx());
    let mut treasury_obj = treasury::new_for_testing<SUI>(sc.ctx());
    let mut insurance_obj = insurance::new_for_testing<SUI>(sc.ctx());
    let mut vault_obj = vault::new_for_testing<SUI>(DEV, sc.ctx());

    // Registry + server (DEV publishes)
    let mut registry = registry::new_registry_for_testing(sc.ctx());
    let cap = publish_test_server(&mut sc, &mut registry, &clk);

    sc.next_tx(DEV);
    let mut server = sc.take_shared<Server>();
    registry::add_tool(
        &mut server,
        &cap,
        b"query",
        b"semantic search",
        b"schema-blob",
        1_000,
        0,
        30,
        &clk,
    );

    // Session (USER funds 50_000)
    sc.next_tx(USER);
    let mut session = session::new_for_testing<SUI>(
        USER,
        balance::create_for_testing<SUI>(50_000),
        0, 0, vector[], 0, &clk, sc.ctx(),
    );

    // Settle one 10_000-amount call
    let receipt_id = settlement::settle_call<SUI>(
        &config,
        &mut session,
        &server,
        &mut vault_obj,
        &mut treasury_obj,
        &mut insurance_obj,
        10_000,
        b"query",
        b"log-blob-1",
        true,
        &clk,
        sc.ctx(),
    );

    // Distribution
    assert!(treasury::balance_value(&treasury_obj) == 200, 0);
    assert!(insurance::balance_value(&insurance_obj) == 50, 1);
    assert!(vault::accrued_balance(&vault_obj) == 9_750, 2);
    assert!(session::balance_value(&session) == 40_000, 3);
    assert!(session::lifetime_spent(&session) == 10_000, 4);

    // Receipt landed at USER
    sc.next_tx(USER);
    {
        let r = sc.take_from_address<CallReceipt>(USER);
        assert!(settlement::receipt_payer(&r) == USER, 5);
        assert!(settlement::receipt_amount(&r) == 10_000, 6);
        assert!(settlement::receipt_dev_share(&r) == 9_750, 7);
        assert!(settlement::receipt_treasury_share(&r) == 200, 8);
        assert!(settlement::receipt_insurance_share(&r) == 50, 9);
        assert!(settlement::receipt_success(&r), 10);
        assert!(!settlement::receipt_refunded(&r), 11);
        assert!(object::id(&r) == receipt_id, 12);
        settlement::destroy_receipt_for_testing(r);
    };

    // Cleanup
    ts::return_shared(server);
    clock::destroy_for_testing(clk);
    admin::destroy_admin_cap_for_testing(admin_cap);
    admin::destroy_config_for_testing(config);
    treasury::destroy_for_testing(treasury_obj);
    insurance::destroy_for_testing(insurance_obj);
    vault::destroy_for_testing(vault_obj);
    registry::destroy_cap_for_testing(cap);
    registry::destroy_registry_for_testing(registry);
    session::destroy_for_testing(session);
    sc.end();
}

#[test]
fun settle_with_zero_amount_mints_receipt_no_distribution() {
    // Free-tier path: amount = 0 → receipt minted, no balances move.
    let mut sc = ts::begin(DEV);
    let clk = clock::create_for_testing(sc.ctx());

    let admin_cap = admin::mint_admin_cap_for_testing(sc.ctx());
    let config = admin::new_config_for_testing(sc.ctx());
    let mut treasury_obj = treasury::new_for_testing<SUI>(sc.ctx());
    let mut insurance_obj = insurance::new_for_testing<SUI>(sc.ctx());
    let mut vault_obj = vault::new_for_testing<SUI>(DEV, sc.ctx());
    let mut registry = registry::new_registry_for_testing(sc.ctx());
    let cap = publish_test_server(&mut sc, &mut registry, &clk);
    sc.next_tx(DEV);
    let mut server = sc.take_shared<Server>();
    registry::add_tool(&mut server, &cap, b"query", b"d", b"s", 1_000, 100, 30, &clk);

    sc.next_tx(USER);
    let mut session = session::new_for_testing<SUI>(
        USER,
        balance::create_for_testing<SUI>(5_000),
        0, 0, vector[], 0, &clk, sc.ctx(),
    );

    settlement::settle_call<SUI>(
        &config, &mut session, &server,
        &mut vault_obj, &mut treasury_obj, &mut insurance_obj,
        0, b"query", b"free-tier-call", true, &clk, sc.ctx(),
    );

    assert!(treasury::balance_value(&treasury_obj) == 0, 0);
    assert!(insurance::balance_value(&insurance_obj) == 0, 1);
    assert!(vault::accrued_balance(&vault_obj) == 0, 2);
    assert!(session::balance_value(&session) == 5_000, 3);

    sc.next_tx(USER);
    {
        let r = sc.take_from_address<CallReceipt>(USER);
        assert!(settlement::receipt_amount(&r) == 0, 4);
        settlement::destroy_receipt_for_testing(r);
    };

    ts::return_shared(server);
    clock::destroy_for_testing(clk);
    admin::destroy_admin_cap_for_testing(admin_cap);
    admin::destroy_config_for_testing(config);
    treasury::destroy_for_testing(treasury_obj);
    insurance::destroy_for_testing(insurance_obj);
    vault::destroy_for_testing(vault_obj);
    registry::destroy_cap_for_testing(cap);
    registry::destroy_registry_for_testing(registry);
    session::destroy_for_testing(session);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::settlement::E_TOOL_NOT_FOUND)]
fun settle_unknown_tool_aborts() {
    let mut sc = ts::begin(DEV);
    let clk = clock::create_for_testing(sc.ctx());

    let admin_cap = admin::mint_admin_cap_for_testing(sc.ctx());
    let config = admin::new_config_for_testing(sc.ctx());
    let mut treasury_obj = treasury::new_for_testing<SUI>(sc.ctx());
    let mut insurance_obj = insurance::new_for_testing<SUI>(sc.ctx());
    let mut vault_obj = vault::new_for_testing<SUI>(DEV, sc.ctx());
    let mut registry = registry::new_registry_for_testing(sc.ctx());
    let cap = publish_test_server(&mut sc, &mut registry, &clk);

    sc.next_tx(DEV);
    let server = sc.take_shared<Server>();

    sc.next_tx(USER);
    let mut session = session::new_for_testing<SUI>(
        USER,
        balance::create_for_testing<SUI>(5_000),
        0, 0, vector[], 0, &clk, sc.ctx(),
    );

    settlement::settle_call<SUI>(
        &config, &mut session, &server,
        &mut vault_obj, &mut treasury_obj, &mut insurance_obj,
        100, b"nonexistent", b"l", true, &clk, sc.ctx(),
    );

    ts::return_shared(server);
    clock::destroy_for_testing(clk);
    admin::destroy_admin_cap_for_testing(admin_cap);
    admin::destroy_config_for_testing(config);
    treasury::destroy_for_testing(treasury_obj);
    insurance::destroy_for_testing(insurance_obj);
    vault::destroy_for_testing(vault_obj);
    registry::destroy_cap_for_testing(cap);
    registry::destroy_registry_for_testing(registry);
    session::destroy_for_testing(session);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::settlement::E_VAULT_OWNER_MISMATCH)]
fun settle_with_wrong_vault_owner_aborts() {
    let mut sc = ts::begin(DEV);
    let clk = clock::create_for_testing(sc.ctx());

    let admin_cap = admin::mint_admin_cap_for_testing(sc.ctx());
    let config = admin::new_config_for_testing(sc.ctx());
    let mut treasury_obj = treasury::new_for_testing<SUI>(sc.ctx());
    let mut insurance_obj = insurance::new_for_testing<SUI>(sc.ctx());
    // Vault owner is the user, not the dev — should abort.
    let mut wrong_vault = vault::new_for_testing<SUI>(USER, sc.ctx());
    let mut registry = registry::new_registry_for_testing(sc.ctx());
    let cap = publish_test_server(&mut sc, &mut registry, &clk);

    sc.next_tx(DEV);
    let mut server = sc.take_shared<Server>();
    registry::add_tool(&mut server, &cap, b"query", b"d", b"s", 100, 0, 10, &clk);

    sc.next_tx(USER);
    let mut session = session::new_for_testing<SUI>(
        USER,
        balance::create_for_testing<SUI>(5_000),
        0, 0, vector[], 0, &clk, sc.ctx(),
    );

    settlement::settle_call<SUI>(
        &config, &mut session, &server,
        &mut wrong_vault, &mut treasury_obj, &mut insurance_obj,
        100, b"query", b"l", true, &clk, sc.ctx(),
    );

    ts::return_shared(server);
    clock::destroy_for_testing(clk);
    admin::destroy_admin_cap_for_testing(admin_cap);
    admin::destroy_config_for_testing(config);
    treasury::destroy_for_testing(treasury_obj);
    insurance::destroy_for_testing(insurance_obj);
    vault::destroy_for_testing(wrong_vault);
    registry::destroy_cap_for_testing(cap);
    registry::destroy_registry_for_testing(registry);
    session::destroy_for_testing(session);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::admin::E_PAUSED)]
fun settle_when_paused_aborts() {
    let mut sc = ts::begin(DEV);
    let clk = clock::create_for_testing(sc.ctx());

    let admin_cap = admin::mint_admin_cap_for_testing(sc.ctx());
    let mut config = admin::new_config_for_testing(sc.ctx());
    admin::set_paused(&admin_cap, &mut config, true, &clk);

    let mut treasury_obj = treasury::new_for_testing<SUI>(sc.ctx());
    let mut insurance_obj = insurance::new_for_testing<SUI>(sc.ctx());
    let mut vault_obj = vault::new_for_testing<SUI>(DEV, sc.ctx());
    let mut registry = registry::new_registry_for_testing(sc.ctx());
    let cap = publish_test_server(&mut sc, &mut registry, &clk);
    sc.next_tx(DEV);
    let mut server = sc.take_shared<Server>();
    registry::add_tool(&mut server, &cap, b"query", b"d", b"s", 100, 0, 10, &clk);

    sc.next_tx(USER);
    let mut session = session::new_for_testing<SUI>(
        USER,
        balance::create_for_testing<SUI>(5_000),
        0, 0, vector[], 0, &clk, sc.ctx(),
    );

    settlement::settle_call<SUI>(
        &config, &mut session, &server,
        &mut vault_obj, &mut treasury_obj, &mut insurance_obj,
        100, b"query", b"l", true, &clk, sc.ctx(),
    );

    ts::return_shared(server);
    clock::destroy_for_testing(clk);
    admin::destroy_admin_cap_for_testing(admin_cap);
    admin::destroy_config_for_testing(config);
    treasury::destroy_for_testing(treasury_obj);
    insurance::destroy_for_testing(insurance_obj);
    vault::destroy_for_testing(vault_obj);
    registry::destroy_cap_for_testing(cap);
    registry::destroy_registry_for_testing(registry);
    session::destroy_for_testing(session);
    sc.end();
}

#[test]
fun settle_with_custom_take_rate_distributes_correctly() {
    // 5% take with 1% insurance carve-out: amount=10_000 →
    // total_take = 500, insurance = 100, treasury = 400, dev = 9_500.
    let mut sc = ts::begin(DEV);
    let clk = clock::create_for_testing(sc.ctx());

    let admin_cap = admin::mint_admin_cap_for_testing(sc.ctx());
    let mut config = admin::new_config_for_testing(sc.ctx());
    admin::set_take_rate(&admin_cap, &mut config, 500, 100);

    let mut treasury_obj = treasury::new_for_testing<SUI>(sc.ctx());
    let mut insurance_obj = insurance::new_for_testing<SUI>(sc.ctx());
    let mut vault_obj = vault::new_for_testing<SUI>(DEV, sc.ctx());
    let mut registry = registry::new_registry_for_testing(sc.ctx());
    let cap = publish_test_server(&mut sc, &mut registry, &clk);
    sc.next_tx(DEV);
    let mut server = sc.take_shared<Server>();
    registry::add_tool(&mut server, &cap, b"query", b"d", b"s", 1_000, 0, 30, &clk);

    sc.next_tx(USER);
    let mut session = session::new_for_testing<SUI>(
        USER,
        balance::create_for_testing<SUI>(50_000),
        0, 0, vector[], 0, &clk, sc.ctx(),
    );

    settlement::settle_call<SUI>(
        &config, &mut session, &server,
        &mut vault_obj, &mut treasury_obj, &mut insurance_obj,
        10_000, b"query", b"l", true, &clk, sc.ctx(),
    );

    assert!(treasury::balance_value(&treasury_obj) == 400, 0);
    assert!(insurance::balance_value(&insurance_obj) == 100, 1);
    assert!(vault::accrued_balance(&vault_obj) == 9_500, 2);
    assert!(session::balance_value(&session) == 40_000, 3);

    sc.next_tx(USER);
    {
        let r = sc.take_from_address<CallReceipt>(USER);
        settlement::destroy_receipt_for_testing(r);
    };

    ts::return_shared(server);
    clock::destroy_for_testing(clk);
    admin::destroy_admin_cap_for_testing(admin_cap);
    admin::destroy_config_for_testing(config);
    treasury::destroy_for_testing(treasury_obj);
    insurance::destroy_for_testing(insurance_obj);
    vault::destroy_for_testing(vault_obj);
    registry::destroy_cap_for_testing(cap);
    registry::destroy_registry_for_testing(registry);
    session::destroy_for_testing(session);
    sc.end();
}
