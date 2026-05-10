#[test_only]
module mcpx::vault_tests;

use mcpx::vault::{Self, DeveloperVault};
use sui::balance;
use sui::clock;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario as ts;

const DEV: address = @0xD;
const STRANGER: address = @0xE;

#[test]
fun create_initialises_with_zero_balances() {
    let mut sc = ts::begin(DEV);
    vault::create<SUI>(sc.ctx());

    sc.next_tx(DEV);
    {
        let v = sc.take_shared<DeveloperVault<SUI>>();
        assert!(vault::owner(&v) == DEV, 0);
        assert!(vault::accrued_balance(&v) == 0, 1);
        assert!(vault::lifetime_earnings(&v) == 0, 2);
        assert!(vault::lifetime_claimed(&v) == 0, 3);
        ts::return_shared(v);
    };
    sc.end();
}

#[test]
fun accrue_then_claim_pays_out_full_balance() {
    let mut sc = ts::begin(DEV);
    let mut v = vault::new_for_testing<SUI>(DEV, sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());

    vault::accrue_for_testing(&mut v, balance::create_for_testing<SUI>(700));
    vault::accrue_for_testing(&mut v, balance::create_for_testing<SUI>(300));
    assert!(vault::accrued_balance(&v) == 1_000, 0);
    assert!(vault::lifetime_earnings(&v) == 1_000, 1);

    vault::claim(&mut v, &clk, sc.ctx());
    assert!(vault::accrued_balance(&v) == 0, 2);
    assert!(vault::lifetime_claimed(&v) == 1_000, 3);
    // lifetime earnings unchanged after claim
    assert!(vault::lifetime_earnings(&v) == 1_000, 4);

    sc.next_tx(DEV);
    {
        let received = sc.take_from_address<coin::Coin<SUI>>(DEV);
        assert!(coin::value(&received) == 1_000, 5);
        coin::burn_for_testing(received);
    };

    clock::destroy_for_testing(clk);
    vault::destroy_for_testing(v);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::vault::E_NOT_OWNER)]
fun stranger_cannot_claim() {
    let mut sc = ts::begin(STRANGER);
    let mut v = vault::new_for_testing<SUI>(DEV, sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());
    vault::accrue_for_testing(&mut v, balance::create_for_testing<SUI>(100));

    vault::claim(&mut v, &clk, sc.ctx());

    clock::destroy_for_testing(clk);
    vault::destroy_for_testing(v);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::vault::E_NOTHING_TO_CLAIM)]
fun claim_with_zero_balance_aborts() {
    let mut sc = ts::begin(DEV);
    let mut v = vault::new_for_testing<SUI>(DEV, sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());

    vault::claim(&mut v, &clk, sc.ctx());

    clock::destroy_for_testing(clk);
    vault::destroy_for_testing(v);
    sc.end();
}

#[test]
fun set_auto_claim_threshold_owner_only() {
    let mut sc = ts::begin(DEV);
    let mut v = vault::new_for_testing<SUI>(DEV, sc.ctx());

    vault::set_auto_claim_threshold(&mut v, 5_000_000, sc.ctx());
    assert!(vault::auto_claim_threshold(&v) == 5_000_000, 0);

    vault::destroy_for_testing(v);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::vault::E_NOT_OWNER)]
fun set_auto_claim_threshold_stranger_aborts() {
    let mut sc = ts::begin(STRANGER);
    let mut v = vault::new_for_testing<SUI>(DEV, sc.ctx());

    vault::set_auto_claim_threshold(&mut v, 5_000_000, sc.ctx());

    vault::destroy_for_testing(v);
    sc.end();
}
