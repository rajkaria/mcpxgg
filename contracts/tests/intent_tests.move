#[test_only]
module mcpx::intent_tests;

use mcpx::intent;
use sui::clock;
use sui::test_scenario as ts;

const USER: address = @0xCAFE;
const AGENT: address = @0xA9E7;

// A dummy server id usable for scope checks without a real Server object.
fun fake_id(sc: &mut ts::Scenario): ID {
    let uid = object::new(sc.ctx());
    let id = object::uid_to_inner(&uid);
    object::delete(uid);
    id
}

#[test]
fun create_carries_per_call_and_categories() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    let srv = fake_id(&mut sc);
    let intent_id = intent::create(
        AGENT,
        10_000,
        2_500,
        vector[srv],
        vector[b"defi", b"analytics"],
        9_999_999,
        &clk,
        sc.ctx(),
    );

    sc.next_tx(USER);
    {
        let i = sc.take_shared<intent::SpendingIntent>();
        assert!(object::id(&i) == intent_id, 0);
        assert!(intent::user(&i) == USER, 1);
        assert!(intent::agent(&i) == AGENT, 2);
        assert!(intent::daily_cap(&i) == 10_000, 3);
        assert!(intent::per_call_cap(&i) == 2_500, 4);
        assert!(vector::length(intent::allowed_categories(&i)) == 2, 5);
        assert!(vector::contains(intent::allowed_categories(&i), &b"defi"), 6);
        ts::return_shared(i);
    };

    clock::destroy_for_testing(clk);
    sc.end();
}

#[test]
fun record_spend_within_caps_accumulates() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    let srv = fake_id(&mut sc);
    intent::create(AGENT, 10_000, 3_000, vector[srv], vector[b"defi"], 0, &clk, sc.ctx());

    sc.next_tx(USER);
    {
        let mut i = sc.take_shared<intent::SpendingIntent>();
        let r1 = fake_id(&mut sc);
        intent::record_spend(&mut i, srv, 1_000, r1, b"defi", &clk);
        let r2 = fake_id(&mut sc);
        intent::record_spend(&mut i, srv, 2_000, r2, b"defi", &clk);
        assert!(intent::today_spent(&i) == 3_000, 0);
        assert!(intent::lifetime_spent(&i) == 3_000, 1);
        ts::return_shared(i);
    };

    clock::destroy_for_testing(clk);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::intent::E_PER_CALL_CAP)]
fun record_spend_over_per_call_cap_aborts() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    intent::create(AGENT, 10_000, 2_000, vector[], vector[], 0, &clk, sc.ctx());

    sc.next_tx(USER);
    {
        let mut i = sc.take_shared<intent::SpendingIntent>();
        let r = fake_id(&mut sc);
        intent::record_spend(&mut i, fake_id(&mut sc), 2_001, r, b"", &clk);
        ts::return_shared(i);
    };

    clock::destroy_for_testing(clk);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::intent::E_DAILY_CAP)]
fun record_spend_over_daily_cap_aborts() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    intent::create(AGENT, 5_000, 0, vector[], vector[], 0, &clk, sc.ctx());

    sc.next_tx(USER);
    {
        let mut i = sc.take_shared<intent::SpendingIntent>();
        let r1 = fake_id(&mut sc);
        intent::record_spend(&mut i, fake_id(&mut sc), 4_000, r1, b"", &clk);
        let r2 = fake_id(&mut sc);
        intent::record_spend(&mut i, fake_id(&mut sc), 2_000, r2, b"", &clk);
        ts::return_shared(i);
    };

    clock::destroy_for_testing(clk);
    sc.end();
}

#[test]
fun daily_cap_rolls_over_next_day() {
    let mut sc = ts::begin(USER);
    let mut clk = clock::create_for_testing(sc.ctx());
    intent::create(AGENT, 5_000, 0, vector[], vector[], 0, &clk, sc.ctx());

    sc.next_tx(USER);
    {
        let mut i = sc.take_shared<intent::SpendingIntent>();
        let r1 = fake_id(&mut sc);
        intent::record_spend(&mut i, fake_id(&mut sc), 5_000, r1, b"", &clk);
        assert!(intent::today_spent(&i) == 5_000, 0);
        // Advance > 1 day.
        clock::set_for_testing(&mut clk, 90_000_000);
        let r2 = fake_id(&mut sc);
        intent::record_spend(&mut i, fake_id(&mut sc), 4_000, r2, b"", &clk);
        assert!(intent::today_spent(&i) == 4_000, 1);
        assert!(intent::lifetime_spent(&i) == 9_000, 2);
        ts::return_shared(i);
    };

    clock::destroy_for_testing(clk);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::intent::E_SCOPE_MISMATCH)]
fun record_spend_category_mismatch_aborts() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    intent::create(AGENT, 10_000, 0, vector[], vector[b"defi"], 0, &clk, sc.ctx());

    sc.next_tx(USER);
    {
        let mut i = sc.take_shared<intent::SpendingIntent>();
        let r = fake_id(&mut sc);
        intent::record_spend(&mut i, fake_id(&mut sc), 100, r, b"gaming", &clk);
        ts::return_shared(i);
    };

    clock::destroy_for_testing(clk);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::intent::E_SCOPE_MISMATCH)]
fun record_spend_server_scope_mismatch_aborts() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    let allowed = fake_id(&mut sc);
    intent::create(AGENT, 10_000, 0, vector[allowed], vector[], 0, &clk, sc.ctx());

    sc.next_tx(USER);
    {
        let mut i = sc.take_shared<intent::SpendingIntent>();
        let r = fake_id(&mut sc);
        intent::record_spend(&mut i, fake_id(&mut sc), 100, r, b"", &clk);
        ts::return_shared(i);
    };

    clock::destroy_for_testing(clk);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::intent::E_EXPIRED)]
fun record_spend_after_expiry_aborts() {
    let mut sc = ts::begin(USER);
    let mut clk = clock::create_for_testing(sc.ctx());
    intent::create(AGENT, 10_000, 0, vector[], vector[], 1_000, &clk, sc.ctx());

    sc.next_tx(USER);
    {
        let mut i = sc.take_shared<intent::SpendingIntent>();
        clock::set_for_testing(&mut clk, 2_000);
        let r = fake_id(&mut sc);
        intent::record_spend(&mut i, fake_id(&mut sc), 100, r, b"", &clk);
        ts::return_shared(i);
    };

    clock::destroy_for_testing(clk);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::intent::E_REVOKED)]
fun record_spend_after_revoke_aborts() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    intent::create(AGENT, 10_000, 0, vector[], vector[], 0, &clk, sc.ctx());

    sc.next_tx(USER);
    {
        let mut i = sc.take_shared<intent::SpendingIntent>();
        intent::revoke(&mut i, &clk, sc.ctx());
        let r = fake_id(&mut sc);
        intent::record_spend(&mut i, fake_id(&mut sc), 100, r, b"", &clk);
        ts::return_shared(i);
    };

    clock::destroy_for_testing(clk);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::intent::E_NOT_OWNER)]
fun revoke_by_non_owner_aborts() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    intent::create(AGENT, 10_000, 0, vector[], vector[], 0, &clk, sc.ctx());

    sc.next_tx(AGENT);
    {
        let mut i = sc.take_shared<intent::SpendingIntent>();
        intent::revoke(&mut i, &clk, sc.ctx());
        ts::return_shared(i);
    };

    clock::destroy_for_testing(clk);
    sc.end();
}
