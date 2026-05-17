/// End-to-end Sprint 1 integration test (S1-T15 in docs/SPRINTS.md).
///
/// Walks the full happy path:
///   1. Dev publishes a server with a tool ("query", price 1_000).
///   2. User creates a session funded with 100_000 atomic units.
///   3. Three calls settle through `settlement::settle_call` — each
///      distributes 9_750 / 200 / 50 to the dev / treasury / insurance.
///   4. Dev claims accrued earnings from the vault.
///   5. Treasury withdraws platform earnings to a recipient address.
///   6. User closes the session and gets the remaining balance refunded.
///
/// Asserts every balance and event-relevant field at each step.
#[test_only]
module mcpx::e2e_tests;

use mcpx::admin;
use mcpx::insurance;
use mcpx::quality;
use mcpx::staking;
use mcpx::registry::{Self, Server};
use mcpx::session::{Self, Session};
use mcpx::settlement::{Self, CallReceipt};
use mcpx::treasury;
use mcpx::vault::{Self, DeveloperVault};
use sui::clock;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario as ts;

const ADMIN: address = @0xAD;
const DEV: address = @0xDE;
const USER: address = @0xC0;
const TREASURY_RECIPIENT: address = @0x77;

#[test]
fun full_lifecycle_publish_session_settle_claim_close() {
    let mut sc = ts::begin(ADMIN);
    let mut clk = clock::create_for_testing(sc.ctx());
    clock::increment_for_testing(&mut clk, 1_700_000_000_000);

    // ─── ADMIN bootstraps platform ───────────────────────────────────────
    let admin_cap = admin::mint_admin_cap_for_testing(sc.ctx());
    admin::init_for_testing(sc.ctx());
    sc.next_tx(ADMIN);
    let config = sc.take_shared<admin::PlatformConfig>();
    treasury::initialize<SUI>(&admin_cap, sc.ctx());
    insurance::initialize<SUI>(&admin_cap, sc.ctx());
    registry::init_for_testing(sc.ctx());

    sc.next_tx(ADMIN);
    let mut treasury_obj = sc.take_shared<treasury::PlatformTreasury<SUI>>();
    let mut insurance_obj = sc.take_shared<insurance::InsurancePool<SUI>>();
    let mut registry_obj = sc.take_shared<registry::NamespaceRegistry>();

    // ─── DEV publishes a server, adds a tool, creates a vault ───────────
    sc.next_tx(DEV);
    let owner_cap = registry::publish_server(
        &mut registry_obj,
        b"e2e-server",
        b"https://server.example",
        b"meta-blob",
        b"search",
        &clk,
        sc.ctx(),
    );

    sc.next_tx(DEV);
    let mut server = sc.take_shared<Server>();
    registry::add_tool(
        &mut server,
        &owner_cap,
        b"query",
        b"semantic search",
        b"schema-blob",
        1_000,
        0,
        30,
        &clk,
    );
    vault::create<SUI>(sc.ctx());

    sc.next_tx(DEV);
    let mut dev_vault = sc.take_shared<DeveloperVault<SUI>>();
    assert!(vault::owner(&dev_vault) == DEV, 0);

    // ─── USER funds a session ───────────────────────────────────────────
    sc.next_tx(USER);
    let initial_deposit = coin::mint_for_testing<SUI>(100_000, sc.ctx());
    let session_key = session::create<SUI>(
        initial_deposit,
        50_000, // per-call cap
        500_000, // per-day cap
        vector[],
        0,
        &clk,
        sc.ctx(),
    );

    sc.next_tx(USER);
    let mut session_obj = sc.take_shared<Session<SUI>>();
    assert!(session::balance_value(&session_obj) == 100_000, 1);

    // ─── 3 settlement calls ─────────────────────────────────────────────
    let mut i: u64 = 0;
    while (i < 3) {
        settlement::settle_call<SUI>(
            &config,
            &mut session_obj,
            &server,
            &mut dev_vault,
            &mut treasury_obj,
            &mut insurance_obj,
            10_000,
            b"query",
            b"log-blob-X",
            true,
            &clk,
            sc.ctx(),
        );
        i = i + 1;
    };

    // After 3 × 10_000 calls, defaults (250 bps / 50 bps insurance):
    // dev share / call = 9_750  → 29_250 total
    // treasury / call  =   200  →    600 total
    // insurance / call =    50  →    150 total
    assert!(vault::accrued_balance(&dev_vault) == 29_250, 2);
    assert!(treasury::balance_value(&treasury_obj) == 600, 3);
    assert!(insurance::balance_value(&insurance_obj) == 150, 4);
    assert!(session::balance_value(&session_obj) == 70_000, 5);
    assert!(session::lifetime_spent(&session_obj) == 30_000, 6);

    // ─── Verify USER holds three CallReceipts ───────────────────────────
    sc.next_tx(USER);
    {
        let receipt_ids = ts::ids_for_address<CallReceipt>(USER);
        assert!(vector::length(&receipt_ids) == 3, 7);
        let mut idx: u64 = 0;
        while (idx < 3) {
            let r = sc.take_from_address<CallReceipt>(USER);
            assert!(settlement::receipt_payer(&r) == USER, 8);
            assert!(settlement::receipt_amount(&r) == 10_000, 9);
            assert!(settlement::receipt_dev_share(&r) == 9_750, 10);
            assert!(settlement::receipt_treasury_share(&r) == 200, 11);
            assert!(settlement::receipt_insurance_share(&r) == 50, 12);
            assert!(settlement::receipt_success(&r), 13);
            settlement::destroy_receipt_for_testing(r);
            idx = idx + 1;
        };
    };

    // ─── DEV claims earnings from the vault ─────────────────────────────
    sc.next_tx(DEV);
    vault::claim(&mut dev_vault, &clk, sc.ctx());
    assert!(vault::accrued_balance(&dev_vault) == 0, 14);
    assert!(vault::lifetime_claimed(&dev_vault) == 29_250, 15);

    sc.next_tx(DEV);
    {
        let payout = sc.take_from_address<coin::Coin<SUI>>(DEV);
        assert!(coin::value(&payout) == 29_250, 16);
        coin::burn_for_testing(payout);
    };

    // ─── ADMIN withdraws treasury balance ───────────────────────────────
    sc.next_tx(ADMIN);
    treasury::withdraw(&admin_cap, &mut treasury_obj, 600, TREASURY_RECIPIENT, &clk, sc.ctx());
    assert!(treasury::balance_value(&treasury_obj) == 0, 17);

    sc.next_tx(TREASURY_RECIPIENT);
    {
        let to_treasury = sc.take_from_address<coin::Coin<SUI>>(TREASURY_RECIPIENT);
        assert!(coin::value(&to_treasury) == 600, 18);
        coin::burn_for_testing(to_treasury);
    };

    // ─── USER tops up + then closes the session ─────────────────────────
    sc.next_tx(USER);
    let topup = coin::mint_for_testing<SUI>(5_000, sc.ctx());
    session::deposit(&mut session_obj, topup, sc.ctx());
    assert!(session::balance_value(&session_obj) == 75_000, 19);

    session::close(&mut session_obj, sc.ctx());
    assert!(!session::is_active(&session_obj), 20);
    assert!(session::balance_value(&session_obj) == 0, 21);

    sc.next_tx(USER);
    {
        let refund = sc.take_from_address<coin::Coin<SUI>>(USER);
        assert!(coin::value(&refund) == 75_000, 22);
        coin::burn_for_testing(refund);
    };

    // ─── Cleanup ────────────────────────────────────────────────────────
    ts::return_shared(server);
    ts::return_shared(dev_vault);
    ts::return_shared(session_obj);
    ts::return_shared(treasury_obj);
    ts::return_shared(insurance_obj);
    ts::return_shared(registry_obj);
    ts::return_shared(config);
    registry::destroy_cap_for_testing(owner_cap);
    session::destroy_key_for_testing(session_key);
    admin::destroy_admin_cap_for_testing(admin_cap);
    clock::destroy_for_testing(clk);
    sc.end();
}

/// S7-T13 — full SLA-staking lifecycle: a dev publishes a server and posts an
/// SLA stake; the quality oracle observes a downtime breach and slashes the
/// stake; the slashed USDsui lands in the InsurancePool.
#[test]
fun e2e_stake_then_downtime_slash_to_insurance() {
    let mut sc = ts::begin(ADMIN);
    let mut clk = clock::create_for_testing(sc.ctx());
    clock::increment_for_testing(&mut clk, 1_700_000_000_000);

    let admin_cap = admin::mint_admin_cap_for_testing(sc.ctx());
    admin::init_for_testing(sc.ctx());
    sc.next_tx(ADMIN);
    let config = sc.take_shared<admin::PlatformConfig>();
    insurance::initialize<SUI>(&admin_cap, sc.ctx());
    registry::init_for_testing(sc.ctx());
    // The oracle's slashing authority (held by the quality-oracle service).
    let oracle_cap = quality::mint_oracle_cap_for_testing(sc.ctx());

    sc.next_tx(ADMIN);
    let mut insurance_obj = sc.take_shared<insurance::InsurancePool<SUI>>();
    let mut registry_obj = sc.take_shared<registry::NamespaceRegistry>();

    // DEV publishes a server.
    sc.next_tx(DEV);
    let owner_cap = registry::publish_server(
        &mut registry_obj,
        b"sla-server",
        b"https://sla.example",
        b"meta-blob",
        b"search",
        &clk,
        sc.ctx(),
    );
    sc.next_tx(DEV);
    let server = sc.take_shared<Server>();
    let server_id = object::id(&server);

    // DEV posts a 50_000_000 stake committing to 99.00% SLA.
    sc.next_tx(DEV);
    let stake_coin = coin::mint_for_testing<SUI>(50_000_000, sc.ctx());
    let stake_id = staking::post<SUI>(
        &config,
        server_id,
        stake_coin,
        9_900,
        86_400,
        1_000,
        &clk,
        sc.ctx(),
    );

    sc.next_tx(DEV);
    let mut stake = sc.take_shared<staking::ServerStake<SUI>>();
    assert!(object::id(&stake) == stake_id, 0);
    assert!(staking::amount(&stake) == 50_000_000, 1);
    assert!(insurance::balance_value(&insurance_obj) == 0, 2);

    // Oracle observed ≥2 breach windows (uptime 96% vs committed 99%) and
    // slashes proportionally to the shortfall: ~3.03% of stake ≈ 1_515_000.
    sc.next_tx(ADMIN);
    staking::slash(
        &oracle_cap,
        &mut stake,
        &mut insurance_obj,
        1_515_000,
        b"sla_breach: uptime 9600 < committed 9900 for 2 windows",
        &clk,
    );

    assert!(staking::amount(&stake) == 48_485_000, 3);
    assert!(staking::lifetime_slashed(&stake) == 1_515_000, 4);
    assert!(insurance::balance_value(&insurance_obj) == 1_515_000, 5);

    ts::return_shared(stake);
    ts::return_shared(server);
    ts::return_shared(insurance_obj);
    ts::return_shared(registry_obj);
    ts::return_shared(config);
    registry::destroy_cap_for_testing(owner_cap);
    quality::destroy_oracle_cap_for_testing(oracle_cap);
    admin::destroy_admin_cap_for_testing(admin_cap);
    clock::destroy_for_testing(clk);
    sc.end();
}

/// S7-T19 — full insurance-claim lifecycle: a user makes a call that fails;
/// they submit the soulbound failed-call receipt to reclaim the cost from the
/// InsurancePool, and the pool balance decreases by the refunded amount.
#[test]
fun e2e_failed_call_claim_decreases_insurance_pool() {
    let mut sc = ts::begin(ADMIN);
    let mut clk = clock::create_for_testing(sc.ctx());
    clock::increment_for_testing(&mut clk, 1_700_000_000_000);

    let admin_cap = admin::mint_admin_cap_for_testing(sc.ctx());
    admin::init_for_testing(sc.ctx());
    sc.next_tx(ADMIN);
    let config = sc.take_shared<admin::PlatformConfig>();
    treasury::initialize<SUI>(&admin_cap, sc.ctx());
    insurance::initialize<SUI>(&admin_cap, sc.ctx());
    registry::init_for_testing(sc.ctx());

    sc.next_tx(ADMIN);
    let mut treasury_obj = sc.take_shared<treasury::PlatformTreasury<SUI>>();
    let mut insurance_obj = sc.take_shared<insurance::InsurancePool<SUI>>();
    let mut registry_obj = sc.take_shared<registry::NamespaceRegistry>();

    // Sponsor pre-funds the pool so it can cover claims (S7-T18 path).
    insurance::top_up<SUI>(&mut insurance_obj, coin::mint_for_testing<SUI>(1_000_000, sc.ctx()));
    assert!(insurance::balance_value(&insurance_obj) == 1_000_000, 0);

    sc.next_tx(DEV);
    let owner_cap = registry::publish_server(
        &mut registry_obj,
        b"flaky-server",
        b"https://flaky.example",
        b"meta-blob",
        b"search",
        &clk,
        sc.ctx(),
    );
    sc.next_tx(DEV);
    let mut server = sc.take_shared<Server>();
    registry::add_tool(
        &mut server, &owner_cap, b"query", b"d", b"s", 1_000, 0, 30, &clk,
    );
    vault::create<SUI>(sc.ctx());
    sc.next_tx(DEV);
    let mut dev_vault = sc.take_shared<DeveloperVault<SUI>>();

    // USER funds a session and makes a call that the server fails.
    sc.next_tx(USER);
    let session_key = session::create<SUI>(
        coin::mint_for_testing<SUI>(100_000, sc.ctx()),
        50_000, 500_000, vector[], 0, &clk, sc.ctx(),
    );
    sc.next_tx(USER);
    let mut session_obj = sc.take_shared<Session<SUI>>();
    settlement::settle_call<SUI>(
        &config, &mut session_obj, &server, &mut dev_vault,
        &mut treasury_obj, &mut insurance_obj,
        10_000, b"query", b"log-blob-fail", false, &clk, sc.ctx(),
    );
    // Failed call still skimmed its 50-atomic insurance share.
    let pool_before = insurance::balance_value(&insurance_obj);
    assert!(pool_before == 1_000_050, 1);

    // USER claims the failed call's cost back from the pool.
    sc.next_tx(USER);
    let mut receipt = sc.take_from_address<CallReceipt>(USER);
    let refunded = settlement::claim_for_failed_call<SUI>(
        &mut receipt, &mut insurance_obj, &clk, sc.ctx(),
    );
    assert!(refunded == 10_000, 2);
    assert!(settlement::receipt_refunded(&receipt), 3);
    assert!(insurance::balance_value(&insurance_obj) == pool_before - 10_000, 4);
    settlement::destroy_receipt_for_testing(receipt);

    // The refund coin landed with USER.
    sc.next_tx(USER);
    {
        let refund = sc.take_from_address<coin::Coin<SUI>>(USER);
        assert!(coin::value(&refund) == 10_000, 5);
        coin::burn_for_testing(refund);
    };

    ts::return_shared(session_obj);
    ts::return_shared(server);
    ts::return_shared(dev_vault);
    ts::return_shared(treasury_obj);
    ts::return_shared(insurance_obj);
    ts::return_shared(registry_obj);
    ts::return_shared(config);
    registry::destroy_cap_for_testing(owner_cap);
    session::destroy_key_for_testing(session_key);
    admin::destroy_admin_cap_for_testing(admin_cap);
    clock::destroy_for_testing(clk);
    sc.end();
}
