/// Smoke tests for the Sprint 1 stub modules. Each is exercised through its
/// public API so we catch integration regressions when the stubs are
/// expanded in later sprints.
#[test_only]
module mcpx::stubs_tests;

use mcpx::access;
use mcpx::admin;
use mcpx::bundle;
use mcpx::insurance;
use mcpx::intent;
use mcpx::quality;
use mcpx::session;
use mcpx::staking;
use sui::balance;
use sui::clock;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario as ts;

const USER: address = @0xA;
const AGENT: address = @0xB;
const DEV: address = @0xC;

fun fresh_id(sc: &mut ts::Scenario): ID {
    let uid = ts::new_object(sc);
    let id = object::uid_to_inner(&uid);
    object::delete(uid);
    id
}

// ─── access ─────────────────────────────────────────────────────────────────

#[test]
fun access_mint_scoped_key_owner_path() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    let s = session::new_for_testing<SUI>(
        USER,
        balance::create_for_testing<SUI>(1_000),
        0, 0, vector[], 0, &clk, sc.ctx(),
    );

    let server_id = fresh_id(&mut sc);
    let key = access::mint_scoped_key<SUI>(&s, vector[server_id], 9_999_999_999, sc.ctx());
    assert!(access::session_id(&key) == object::id(&s), 0);
    assert!(*access::server_ids(&key) == vector[server_id], 1);
    assert!(!access::is_revoked(&key), 2);

    clock::destroy_for_testing(clk);
    session::destroy_for_testing(s);
    access::destroy_for_testing(key);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::access::E_INVALID_EXPIRY)]
fun access_zero_expiry_aborts() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    let s = session::new_for_testing<SUI>(
        USER,
        balance::create_for_testing<SUI>(1_000),
        0, 0, vector[], 0, &clk, sc.ctx(),
    );

    let key = access::mint_scoped_key<SUI>(&s, vector[], 0, sc.ctx());

    clock::destroy_for_testing(clk);
    session::destroy_for_testing(s);
    access::destroy_for_testing(key);
    sc.end();
}

// ─── intent ─────────────────────────────────────────────────────────────────

#[test]
fun intent_create_revoke_round_trip() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    let intent_id = intent::create(AGENT, 5_000, 0, vector[], vector[], 9_999_999, &clk, sc.ctx());

    sc.next_tx(USER);
    {
        let mut i = sc.take_shared<intent::SpendingIntent>();
        assert!(object::id(&i) == intent_id, 0);
        assert!(intent::user(&i) == USER, 1);
        assert!(intent::agent(&i) == AGENT, 2);
        intent::revoke(&mut i, &clk, sc.ctx());
        assert!(intent::is_revoked(&i), 3);
        ts::return_shared(i);
    };

    clock::destroy_for_testing(clk);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::intent::E_INVALID_AGENT)]
fun intent_zero_agent_aborts() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    intent::create(@0x0, 1_000, 0, vector[], vector[], 0, &clk, sc.ctx());
    clock::destroy_for_testing(clk);
    sc.end();
}

// ─── bundle ─────────────────────────────────────────────────────────────────

#[test]
fun bundle_create_with_servers() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    let s1 = fresh_id(&mut sc);
    let s2 = fresh_id(&mut sc);

    let bundle_id = bundle::create(
        b"defi-toolkit",
        vector[s1, s2],
        90, // 0.9× → 10% discount
        b"meta-blob",
        &clk,
        sc.ctx(),
    );

    sc.next_tx(USER);
    {
        let b = sc.take_shared<bundle::Bundle>();
        assert!(object::id(&b) == bundle_id, 0);
        assert!(bundle::server_count(&b) == 2, 1);
        assert!(bundle::price_multiplier_x100(&b) == 90, 2);
        assert!(bundle::is_active(&b), 3);
        ts::return_shared(b);
    };

    clock::destroy_for_testing(clk);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::bundle::E_NO_SERVERS)]
fun bundle_with_no_servers_aborts() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    bundle::create(b"empty", vector[], 100, b"", &clk, sc.ctx());
    clock::destroy_for_testing(clk);
    sc.end();
}

// ─── staking ────────────────────────────────────────────────────────────────

#[test]
fun staking_post_and_slash_distributes_to_insurance() {
    let mut sc = ts::begin(DEV);
    let clk = clock::create_for_testing(sc.ctx());
    let admin_cap = admin::mint_admin_cap_for_testing(sc.ctx());
    let config = admin::new_config_for_testing(sc.ctx());
    let mut pool = insurance::new_for_testing<SUI>(sc.ctx());
    let oracle_cap = quality::mint_oracle_cap_for_testing(sc.ctx());

    let server_id = fresh_id(&mut sc);
    let stake_coin = coin::mint_for_testing<SUI>(50_000_000, sc.ctx());
    let stake_id = staking::post<SUI>(
        &config,
        server_id,
        stake_coin,
        9_900, // 99.00% SLA
        86_400,
        1_000,
        &clk,
        sc.ctx(),
    );

    // Oracle attests a breach (96.00% < committed 99.00%) for this server.
    quality::attest(
        &oracle_cap, server_id, 6_000, 9_600, 120, 400, 50, 0, 1_000, &clk, sc.ctx(),
    );

    sc.next_tx(DEV);
    {
        let mut stake = sc.take_shared<staking::ServerStake<SUI>>();
        let attestation = sc.take_shared<quality::QualityAttestation>();
        assert!(object::id(&stake) == stake_id, 0);
        assert!(staking::amount(&stake) == 50_000_000, 1);
        assert!(staking::owner(&stake) == DEV, 2);
        assert!(staking::sla_uptime_x100(&stake) == 9_900, 3);

        // Oracle slashes 10%, proven by the attested breach.
        staking::slash(
            &oracle_cap, &mut stake, &mut pool, &attestation, 5_000_000, b"sla_breach", &clk,
        );
        assert!(staking::amount(&stake) == 45_000_000, 4);
        assert!(staking::lifetime_slashed(&stake) == 5_000_000, 5);
        assert!(insurance::balance_value(&pool) == 5_000_000, 6);
        ts::return_shared(stake);
        ts::return_shared(attestation);
    };

    clock::destroy_for_testing(clk);
    admin::destroy_admin_cap_for_testing(admin_cap);
    admin::destroy_config_for_testing(config);
    insurance::destroy_for_testing(pool);
    quality::destroy_oracle_cap_for_testing(oracle_cap);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::staking::E_BELOW_MINIMUM)]
fun staking_below_minimum_aborts() {
    let mut sc = ts::begin(DEV);
    let clk = clock::create_for_testing(sc.ctx());
    let config = admin::new_config_for_testing(sc.ctx());

    let server_id = fresh_id(&mut sc);
    let tiny = coin::mint_for_testing<SUI>(1_000, sc.ctx()); // way under 10 USDsui min
    staking::post<SUI>(&config, server_id, tiny, 9_000, 86_400, 0, &clk, sc.ctx());

    clock::destroy_for_testing(clk);
    admin::destroy_config_for_testing(config);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::staking::E_NO_SLA_BREACH)]
fun staking_slash_without_breach_aborts() {
    let mut sc = ts::begin(DEV);
    let clk = clock::create_for_testing(sc.ctx());
    let config = admin::new_config_for_testing(sc.ctx());
    let mut pool = insurance::new_for_testing<SUI>(sc.ctx());
    let oracle_cap = quality::mint_oracle_cap_for_testing(sc.ctx());

    let server_id = fresh_id(&mut sc);
    let stake_coin = coin::mint_for_testing<SUI>(50_000_000, sc.ctx());
    staking::post<SUI>(&config, server_id, stake_coin, 9_900, 86_400, 1_000, &clk, sc.ctx());

    // Attestation reports 99.50% — at or above the 99.00% commitment, so NOT
    // a breach: an OracleCap holder must not be able to slash an in-SLA server.
    quality::attest(
        &oracle_cap, server_id, 9_900, 9_950, 80, 100, 50, 0, 1_000, &clk, sc.ctx(),
    );

    sc.next_tx(DEV);
    let mut stake = sc.take_shared<staking::ServerStake<SUI>>();
    let attestation = sc.take_shared<quality::QualityAttestation>();
    staking::slash(
        &oracle_cap, &mut stake, &mut pool, &attestation, 1_000_000, b"unjust", &clk,
    );

    ts::return_shared(stake);
    ts::return_shared(attestation);
    clock::destroy_for_testing(clk);
    admin::destroy_config_for_testing(config);
    insurance::destroy_for_testing(pool);
    quality::destroy_oracle_cap_for_testing(oracle_cap);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::staking::E_ATTESTATION_SERVER_MISMATCH)]
fun staking_slash_with_wrong_server_attestation_aborts() {
    let mut sc = ts::begin(DEV);
    let clk = clock::create_for_testing(sc.ctx());
    let config = admin::new_config_for_testing(sc.ctx());
    let mut pool = insurance::new_for_testing<SUI>(sc.ctx());
    let oracle_cap = quality::mint_oracle_cap_for_testing(sc.ctx());

    let staked_server = fresh_id(&mut sc);
    let other_server = fresh_id(&mut sc);
    let stake_coin = coin::mint_for_testing<SUI>(50_000_000, sc.ctx());
    staking::post<SUI>(&config, staked_server, stake_coin, 9_900, 86_400, 1_000, &clk, sc.ctx());

    // A real breach, but attested for a DIFFERENT server — must not slash this stake.
    quality::attest(
        &oracle_cap, other_server, 5_000, 9_000, 200, 800, 50, 0, 1_000, &clk, sc.ctx(),
    );

    sc.next_tx(DEV);
    let mut stake = sc.take_shared<staking::ServerStake<SUI>>();
    let attestation = sc.take_shared<quality::QualityAttestation>();
    staking::slash(
        &oracle_cap, &mut stake, &mut pool, &attestation, 1_000_000, b"wrong server", &clk,
    );

    ts::return_shared(stake);
    ts::return_shared(attestation);
    clock::destroy_for_testing(clk);
    admin::destroy_config_for_testing(config);
    insurance::destroy_for_testing(pool);
    quality::destroy_oracle_cap_for_testing(oracle_cap);
    sc.end();
}
