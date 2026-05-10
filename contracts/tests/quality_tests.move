#[test_only]
module mcpx::quality_tests;

use mcpx::admin;
use mcpx::quality::{Self, QualityAttestation};
use sui::clock;
use sui::test_scenario as ts;

const ADMIN: address = @0xA;
const ORACLE: address = @0xB;

fun fresh_id(sc: &mut ts::Scenario): ID {
    let uid = ts::new_object(sc);
    let id = object::uid_to_inner(&uid);
    object::delete(uid);
    id
}

#[test]
fun mint_oracle_cap_transfers_to_recipient() {
    let mut sc = ts::begin(ADMIN);
    let admin_cap = admin::mint_admin_cap_for_testing(sc.ctx());
    quality::mint_oracle_cap(&admin_cap, ORACLE, sc.ctx());

    sc.next_tx(ORACLE);
    {
        let oracle_cap = sc.take_from_address<quality::OracleCap>(ORACLE);
        quality::destroy_oracle_cap_for_testing(oracle_cap);
    };

    admin::destroy_admin_cap_for_testing(admin_cap);
    sc.end();
}

#[test]
fun attest_creates_shared_attestation_with_event() {
    let mut sc = ts::begin(ORACLE);
    let oracle_cap = quality::mint_oracle_cap_for_testing(sc.ctx());
    let mut clk = clock::create_for_testing(sc.ctx());
    clock::increment_for_testing(&mut clk, 5_000_000);
    let server_id = fresh_id(&mut sc);

    quality::attest(
        &oracle_cap,
        server_id,
        9_950, // score 99.50%
        9_980, // uptime 99.80%
        120,   // p95 latency 120ms
        50,    // 0.50% errors
        10_000,
        1_000_000,
        4_000_000,
        &clk,
        sc.ctx(),
    );

    sc.next_tx(ORACLE);
    {
        let a = sc.take_shared<QualityAttestation>();
        assert!(quality::server_id(&a) == server_id, 0);
        assert!(quality::score_x100(&a) == 9_950, 1);
        assert!(quality::uptime_x100(&a) == 9_980, 2);
        assert!(quality::p95_latency_ms(&a) == 120, 3);
        assert!(quality::sample_count(&a) == 10_000, 4);
        ts::return_shared(a);
    };

    clock::destroy_for_testing(clk);
    quality::destroy_oracle_cap_for_testing(oracle_cap);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::quality::E_INVALID_SCORE)]
fun attest_score_above_100pct_aborts() {
    let mut sc = ts::begin(ORACLE);
    let oracle_cap = quality::mint_oracle_cap_for_testing(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());
    let server_id = fresh_id(&mut sc);

    quality::attest(
        &oracle_cap,
        server_id,
        10_001, // > 10_000 → abort
        9_000,
        100,
        10,
        100,
        0,
        1_000,
        &clk,
        sc.ctx(),
    );

    clock::destroy_for_testing(clk);
    quality::destroy_oracle_cap_for_testing(oracle_cap);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::quality::E_INVALID_WINDOW)]
fun attest_inverted_window_aborts() {
    let mut sc = ts::begin(ORACLE);
    let oracle_cap = quality::mint_oracle_cap_for_testing(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());
    let server_id = fresh_id(&mut sc);

    quality::attest(
        &oracle_cap,
        server_id, 9_000, 9_000, 100, 10, 100,
        2_000, // start > end
        1_000,
        &clk,
        sc.ctx(),
    );

    clock::destroy_for_testing(clk);
    quality::destroy_oracle_cap_for_testing(oracle_cap);
    sc.end();
}
