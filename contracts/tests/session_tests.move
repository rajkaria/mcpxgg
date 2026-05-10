#[test_only]
module mcpx::session_tests;

use mcpx::session::{Self, Session};
use sui::balance;
use sui::clock;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario as ts;

const USER: address = @0xC0FFEE;
const STRANGER: address = @0xBEEF;

fun fresh_id(sc: &mut ts::Scenario): ID {
    let uid = ts::new_object(sc);
    let id = object::uid_to_inner(&uid);
    object::delete(uid);
    id
}

#[test]
fun create_session_initialises_state_and_transfers_key() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    let coin = coin::mint_for_testing<SUI>(10_000, sc.ctx());

    let key = session::create<SUI>(
        coin,
        500, // per-call cap
        2_000, // per-day cap
        vector[],
        0,
        &clk,
        sc.ctx(),
    );

    sc.next_tx(USER);
    {
        let s = sc.take_shared<Session<SUI>>();
        assert!(session::owner(&s) == USER, 0);
        assert!(session::balance_value(&s) == 10_000, 1);
        assert!(session::per_call_cap_atomic(&s) == 500, 2);
        assert!(session::per_day_cap_atomic(&s) == 2_000, 3);
        assert!(session::is_active(&s), 4);
        assert!(session::lifetime_deposited(&s) == 10_000, 5);
        assert!(session::key_session_id(&key) == object::id(&s), 6);
        ts::return_shared(s);
    };

    clock::destroy_for_testing(clk);
    session::destroy_key_for_testing(key);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::session::E_ZERO_DEPOSIT)]
fun create_with_zero_deposit_aborts() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    let coin = coin::mint_for_testing<SUI>(0, sc.ctx());

    let key = session::create<SUI>(coin, 0, 0, vector[], 0, &clk, sc.ctx());

    clock::destroy_for_testing(clk);
    session::destroy_key_for_testing(key);
    sc.end();
}

#[test]
fun deposit_grows_balance_and_lifetime() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    let mut s = session::new_for_testing<SUI>(
        USER,
        balance::create_for_testing<SUI>(1_000),
        0, 0, vector[], 0, &clk, sc.ctx(),
    );

    let topup = coin::mint_for_testing<SUI>(500, sc.ctx());
    session::deposit(&mut s, topup, sc.ctx());
    assert!(session::balance_value(&s) == 1_500, 0);
    assert!(session::lifetime_deposited(&s) == 1_500, 1);

    clock::destroy_for_testing(clk);
    session::destroy_for_testing(s);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::session::E_NOT_OWNER)]
fun deposit_by_non_owner_aborts() {
    let mut sc = ts::begin(STRANGER);
    let clk = clock::create_for_testing(sc.ctx());
    let mut s = session::new_for_testing<SUI>(
        USER,
        balance::create_for_testing<SUI>(1_000),
        0, 0, vector[], 0, &clk, sc.ctx(),
    );
    let topup = coin::mint_for_testing<SUI>(500, sc.ctx());
    session::deposit(&mut s, topup, sc.ctx());

    clock::destroy_for_testing(clk);
    session::destroy_for_testing(s);
    sc.end();
}

#[test]
fun withdraw_pays_owner_and_decrements_balance() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    let mut s = session::new_for_testing<SUI>(
        USER,
        balance::create_for_testing<SUI>(1_000),
        0, 0, vector[], 0, &clk, sc.ctx(),
    );

    session::withdraw(&mut s, 300, sc.ctx());
    assert!(session::balance_value(&s) == 700, 0);
    sc.next_tx(USER);
    {
        let received = sc.take_from_address<coin::Coin<SUI>>(USER);
        assert!(coin::value(&received) == 300, 1);
        coin::burn_for_testing(received);
    };

    clock::destroy_for_testing(clk);
    session::destroy_for_testing(s);
    sc.end();
}

#[test]
fun debit_decrements_balance_and_tracks_spend() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    let server_id = fresh_id(&mut sc);
    let mut s = session::new_for_testing<SUI>(
        USER,
        balance::create_for_testing<SUI>(10_000),
        0, 0, vector[], 0, &clk, sc.ctx(),
    );

    let bal = session::debit_for_testing(&mut s, 1_500, server_id, &clk);
    assert!(balance::value(&bal) == 1_500, 0);
    assert!(session::balance_value(&s) == 8_500, 1);
    assert!(session::today_spent_atomic(&s) == 1_500, 2);
    assert!(session::lifetime_spent(&s) == 1_500, 3);

    balance::destroy_for_testing(bal);
    clock::destroy_for_testing(clk);
    session::destroy_for_testing(s);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::session::E_PER_CALL_CAP)]
fun debit_exceeding_per_call_cap_aborts() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    let server_id = fresh_id(&mut sc);
    let mut s = session::new_for_testing<SUI>(
        USER,
        balance::create_for_testing<SUI>(10_000),
        500, 0, vector[], 0, &clk, sc.ctx(),
    );

    let bal = session::debit_for_testing(&mut s, 600, server_id, &clk);

    balance::destroy_for_testing(bal);
    clock::destroy_for_testing(clk);
    session::destroy_for_testing(s);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::session::E_PER_DAY_CAP)]
fun debit_exceeding_per_day_cap_aborts() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    let server_id = fresh_id(&mut sc);
    let mut s = session::new_for_testing<SUI>(
        USER,
        balance::create_for_testing<SUI>(10_000),
        0, 1_000, vector[], 0, &clk, sc.ctx(),
    );

    let bal1 = session::debit_for_testing(&mut s, 700, server_id, &clk);
    let bal2 = session::debit_for_testing(&mut s, 400, server_id, &clk);

    balance::destroy_for_testing(bal1);
    balance::destroy_for_testing(bal2);
    clock::destroy_for_testing(clk);
    session::destroy_for_testing(s);
    sc.end();
}

#[test]
fun day_window_resets_after_one_day() {
    let mut sc = ts::begin(USER);
    let mut clk = clock::create_for_testing(sc.ctx());
    let server_id = fresh_id(&mut sc);
    let mut s = session::new_for_testing<SUI>(
        USER,
        balance::create_for_testing<SUI>(10_000),
        0, 1_000, vector[], 0, &clk, sc.ctx(),
    );

    let bal1 = session::debit_for_testing(&mut s, 700, server_id, &clk);
    // Advance past midnight
    clock::increment_for_testing(&mut clk, 86_400_001);
    let bal2 = session::debit_for_testing(&mut s, 700, server_id, &clk);
    assert!(session::today_spent_atomic(&s) == 700, 0);

    balance::destroy_for_testing(bal1);
    balance::destroy_for_testing(bal2);
    clock::destroy_for_testing(clk);
    session::destroy_for_testing(s);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::session::E_SCOPE_MISMATCH)]
fun debit_outside_scope_aborts() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    let allowed = fresh_id(&mut sc);
    let other = fresh_id(&mut sc);
    let mut s = session::new_for_testing<SUI>(
        USER,
        balance::create_for_testing<SUI>(10_000),
        0, 0, vector[allowed], 0, &clk, sc.ctx(),
    );

    let bal = session::debit_for_testing(&mut s, 100, other, &clk);

    balance::destroy_for_testing(bal);
    clock::destroy_for_testing(clk);
    session::destroy_for_testing(s);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::session::E_EXPIRED)]
fun debit_after_expiry_aborts() {
    let mut sc = ts::begin(USER);
    let mut clk = clock::create_for_testing(sc.ctx());
    let server_id = fresh_id(&mut sc);
    let mut s = session::new_for_testing<SUI>(
        USER,
        balance::create_for_testing<SUI>(10_000),
        0, 0, vector[], 1_000, &clk, sc.ctx(),
    );
    clock::increment_for_testing(&mut clk, 5_000);

    let bal = session::debit_for_testing(&mut s, 100, server_id, &clk);

    balance::destroy_for_testing(bal);
    clock::destroy_for_testing(clk);
    session::destroy_for_testing(s);
    sc.end();
}

#[test]
fun close_refunds_remaining_balance_and_deactivates() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    let mut s = session::new_for_testing<SUI>(
        USER,
        balance::create_for_testing<SUI>(2_500),
        0, 0, vector[], 0, &clk, sc.ctx(),
    );

    session::close(&mut s, sc.ctx());
    assert!(!session::is_active(&s), 0);
    assert!(session::balance_value(&s) == 0, 1);

    sc.next_tx(USER);
    {
        let refund = sc.take_from_address<coin::Coin<SUI>>(USER);
        assert!(coin::value(&refund) == 2_500, 2);
        coin::burn_for_testing(refund);
    };

    clock::destroy_for_testing(clk);
    session::destroy_for_testing(s);
    sc.end();
}

#[test]
fun update_limits_changes_caps() {
    let mut sc = ts::begin(USER);
    let clk = clock::create_for_testing(sc.ctx());
    let mut s = session::new_for_testing<SUI>(
        USER,
        balance::create_for_testing<SUI>(1_000),
        100, 500, vector[], 0, &clk, sc.ctx(),
    );

    session::update_limits(&mut s, 1_000, 5_000, sc.ctx());
    assert!(session::per_call_cap_atomic(&s) == 1_000, 0);
    assert!(session::per_day_cap_atomic(&s) == 5_000, 1);

    clock::destroy_for_testing(clk);
    session::destroy_for_testing(s);
    sc.end();
}
