#[test_only]
module mcpx::treasury_tests;

use mcpx::admin;
use mcpx::treasury::{Self, PlatformTreasury};
use sui::balance;
use sui::clock;
use sui::coin;
use sui::sui::SUI; // mock coin type for tests
use sui::test_scenario as ts;

const ADMIN: address = @0xA;
const RECIPIENT: address = @0xB;

#[test]
fun initialize_creates_empty_treasury() {
    let mut sc = ts::begin(ADMIN);
    let cap = admin::mint_admin_cap_for_testing(sc.ctx());
    treasury::initialize<SUI>(&cap, sc.ctx());

    sc.next_tx(ADMIN);
    {
        let t = sc.take_shared<PlatformTreasury<SUI>>();
        assert!(treasury::balance_value(&t) == 0, 0);
        assert!(treasury::lifetime_collected(&t) == 0, 1);
        ts::return_shared(t);
    };
    admin::destroy_admin_cap_for_testing(cap);
    sc.end();
}

#[test]
fun collect_increases_balance_and_lifetime() {
    let mut sc = ts::begin(ADMIN);
    let mut t = treasury::new_for_testing<SUI>(sc.ctx());
    let fee = balance::create_for_testing<SUI>(123_456);

    treasury::collect_for_testing(&mut t, fee);
    assert!(treasury::balance_value(&t) == 123_456, 0);
    assert!(treasury::lifetime_collected(&t) == 123_456, 1);

    let fee2 = balance::create_for_testing<SUI>(100);
    treasury::collect_for_testing(&mut t, fee2);
    assert!(treasury::balance_value(&t) == 123_556, 2);
    assert!(treasury::lifetime_collected(&t) == 123_556, 3);

    treasury::destroy_for_testing(t);
    sc.end();
}

#[test]
fun withdraw_transfers_to_recipient_and_decrements_balance() {
    let mut sc = ts::begin(ADMIN);
    let cap = admin::mint_admin_cap_for_testing(sc.ctx());
    let mut t = treasury::new_for_testing<SUI>(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());

    treasury::collect_for_testing(&mut t, balance::create_for_testing<SUI>(1_000));
    treasury::withdraw(&cap, &mut t, 400, RECIPIENT, &clk, sc.ctx());
    assert!(treasury::balance_value(&t) == 600, 0);
    assert!(treasury::lifetime_withdrawn(&t) == 400, 1);

    sc.next_tx(RECIPIENT);
    {
        let received = sc.take_from_address<coin::Coin<SUI>>(RECIPIENT);
        assert!(coin::value(&received) == 400, 2);
        coin::burn_for_testing(received);
    };

    clock::destroy_for_testing(clk);
    admin::destroy_admin_cap_for_testing(cap);
    treasury::destroy_for_testing(t);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::treasury::E_INSUFFICIENT_BALANCE)]
fun withdraw_more_than_balance_aborts() {
    let mut sc = ts::begin(ADMIN);
    let cap = admin::mint_admin_cap_for_testing(sc.ctx());
    let mut t = treasury::new_for_testing<SUI>(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());

    treasury::collect_for_testing(&mut t, balance::create_for_testing<SUI>(100));
    treasury::withdraw(&cap, &mut t, 200, RECIPIENT, &clk, sc.ctx());

    clock::destroy_for_testing(clk);
    admin::destroy_admin_cap_for_testing(cap);
    treasury::destroy_for_testing(t);
    sc.end();
}
