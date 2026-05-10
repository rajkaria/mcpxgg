#[test_only]
module mcpx::admin_tests;

use mcpx::admin::{Self, PlatformConfig};
use sui::clock;
use sui::test_scenario as ts;

const ADMIN: address = @0xA;

#[test]
fun init_creates_config_with_defaults() {
    let mut sc = ts::begin(ADMIN);
    {
        admin::init_for_testing(sc.ctx());
    };
    sc.next_tx(ADMIN);
    {
        let config = sc.take_shared<PlatformConfig>();
        assert!(admin::take_rate_bps(&config) == 250, 0);
        assert!(admin::insurance_bps(&config) == 50, 1);
        assert!(admin::treasury_bps(&config) == 200, 2);
        assert!(admin::subsidy_atomic(&config) == 1_000_000, 3);
        assert!(!admin::is_paused(&config), 4);
        assert!(admin::version(&config) == 1, 5);
        ts::return_shared(config);
    };
    sc.end();
}

#[test]
fun set_take_rate_updates_both_bps() {
    let mut sc = ts::begin(ADMIN);
    let cap = admin::mint_admin_cap_for_testing(sc.ctx());
    let mut config = admin::new_config_for_testing(sc.ctx());

    admin::set_take_rate(&cap, &mut config, 500, 100);
    assert!(admin::take_rate_bps(&config) == 500, 0);
    assert!(admin::insurance_bps(&config) == 100, 1);
    assert!(admin::treasury_bps(&config) == 400, 2);

    admin::destroy_admin_cap_for_testing(cap);
    admin::destroy_config_for_testing(config);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::admin::E_INVALID_BPS)]
fun set_take_rate_above_max_aborts() {
    let mut sc = ts::begin(ADMIN);
    let cap = admin::mint_admin_cap_for_testing(sc.ctx());
    let mut config = admin::new_config_for_testing(sc.ctx());

    admin::set_take_rate(&cap, &mut config, admin::max_take_rate_bps_for_testing() + 1, 0);

    admin::destroy_admin_cap_for_testing(cap);
    admin::destroy_config_for_testing(config);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::admin::E_INSURANCE_EXCEEDS_TAKE)]
fun insurance_above_take_aborts() {
    let mut sc = ts::begin(ADMIN);
    let cap = admin::mint_admin_cap_for_testing(sc.ctx());
    let mut config = admin::new_config_for_testing(sc.ctx());

    admin::set_take_rate(&cap, &mut config, 200, 250);

    admin::destroy_admin_cap_for_testing(cap);
    admin::destroy_config_for_testing(config);
    sc.end();
}

#[test]
fun pause_then_unpause_round_trip() {
    let mut sc = ts::begin(ADMIN);
    let cap = admin::mint_admin_cap_for_testing(sc.ctx());
    let mut config = admin::new_config_for_testing(sc.ctx());
    let mut clk = clock::create_for_testing(sc.ctx());

    admin::set_paused(&cap, &mut config, true, &clk);
    assert!(admin::is_paused(&config), 0);

    clock::increment_for_testing(&mut clk, 1000);
    admin::set_paused(&cap, &mut config, false, &clk);
    assert!(!admin::is_paused(&config), 1);

    admin::assert_not_paused(&config);

    clock::destroy_for_testing(clk);
    admin::destroy_admin_cap_for_testing(cap);
    admin::destroy_config_for_testing(config);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::admin::E_PAUSED)]
fun assert_not_paused_aborts_when_paused() {
    let mut sc = ts::begin(ADMIN);
    let cap = admin::mint_admin_cap_for_testing(sc.ctx());
    let mut config = admin::new_config_for_testing(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());

    admin::set_paused(&cap, &mut config, true, &clk);
    admin::assert_not_paused(&config);

    clock::destroy_for_testing(clk);
    admin::destroy_admin_cap_for_testing(cap);
    admin::destroy_config_for_testing(config);
    sc.end();
}

#[test]
fun set_subsidy_updates_value() {
    let mut sc = ts::begin(ADMIN);
    let cap = admin::mint_admin_cap_for_testing(sc.ctx());
    let mut config = admin::new_config_for_testing(sc.ctx());

    admin::set_subsidy(&cap, &mut config, 5_000_000);
    assert!(admin::subsidy_atomic(&config) == 5_000_000, 0);

    admin::destroy_admin_cap_for_testing(cap);
    admin::destroy_config_for_testing(config);
    sc.end();
}

#[test]
fun set_sla_min_stake_updates_value() {
    let mut sc = ts::begin(ADMIN);
    let cap = admin::mint_admin_cap_for_testing(sc.ctx());
    let mut config = admin::new_config_for_testing(sc.ctx());

    admin::set_sla_min_stake(&cap, &mut config, 50_000_000);
    assert!(admin::sla_min_stake_atomic(&config) == 50_000_000, 0);

    admin::destroy_admin_cap_for_testing(cap);
    admin::destroy_config_for_testing(config);
    sc.end();
}
