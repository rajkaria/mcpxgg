#[test_only]
module mcpx::insurance_tests;

use mcpx::admin;
use mcpx::insurance::{Self, InsurancePool};
use sui::balance;
use sui::clock;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario as ts;

const ADMIN: address = @0xA;
const ORACLE: address = @0xB;
const VICTIM: address = @0xC;

#[test]
fun initialize_creates_empty_pool() {
    let mut sc = ts::begin(ADMIN);
    let cap = admin::mint_admin_cap_for_testing(sc.ctx());
    insurance::initialize<SUI>(&cap, sc.ctx());

    sc.next_tx(ADMIN);
    {
        let p = sc.take_shared<InsurancePool<SUI>>();
        assert!(insurance::balance_value(&p) == 0, 0);
        ts::return_shared(p);
    };
    admin::destroy_admin_cap_for_testing(cap);
    sc.end();
}

#[test]
fun collect_and_top_up_both_grow_balance() {
    let mut sc = ts::begin(ADMIN);
    let mut p = insurance::new_for_testing<SUI>(sc.ctx());

    insurance::collect_for_testing(&mut p, balance::create_for_testing<SUI>(50));
    assert!(insurance::balance_value(&p) == 50, 0);

    let donation = coin::mint_for_testing<SUI>(75, sc.ctx());
    insurance::top_up(&mut p, donation);
    assert!(insurance::balance_value(&p) == 125, 1);
    assert!(insurance::lifetime_collected(&p) == 125, 2);

    insurance::destroy_for_testing(p);
    sc.end();
}

#[test]
fun pay_out_transfers_and_increments_lifetime_paid() {
    let mut sc = ts::begin(ADMIN);
    let payer_cap = insurance::mint_payer_cap_for_testing(sc.ctx());
    let mut p = insurance::new_for_testing<SUI>(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());
    insurance::collect_for_testing(&mut p, balance::create_for_testing<SUI>(1_000));

    insurance::pay_out(
        &payer_cap,
        &mut p,
        300,
        VICTIM,
        b"outage_2026_05_10",
        &clk,
        sc.ctx(),
    );
    assert!(insurance::balance_value(&p) == 700, 0);
    assert!(insurance::lifetime_paid(&p) == 300, 1);

    sc.next_tx(VICTIM);
    {
        let received = sc.take_from_address<coin::Coin<SUI>>(VICTIM);
        assert!(coin::value(&received) == 300, 2);
        coin::burn_for_testing(received);
    };

    clock::destroy_for_testing(clk);
    insurance::destroy_payer_cap_for_testing(payer_cap);
    insurance::destroy_for_testing(p);
    sc.end();
}

#[test]
#[expected_failure(abort_code = mcpx::insurance::E_INSUFFICIENT_BALANCE)]
fun pay_out_above_balance_aborts() {
    let mut sc = ts::begin(ADMIN);
    let payer_cap = insurance::mint_payer_cap_for_testing(sc.ctx());
    let mut p = insurance::new_for_testing<SUI>(sc.ctx());
    let clk = clock::create_for_testing(sc.ctx());
    insurance::collect_for_testing(&mut p, balance::create_for_testing<SUI>(50));

    insurance::pay_out(&payer_cap, &mut p, 100, VICTIM, b"x", &clk, sc.ctx());

    clock::destroy_for_testing(clk);
    insurance::destroy_payer_cap_for_testing(payer_cap);
    insurance::destroy_for_testing(p);
    sc.end();
}

#[test]
fun mint_payer_cap_transfers_to_recipient() {
    let mut sc = ts::begin(ADMIN);
    let cap = admin::mint_admin_cap_for_testing(sc.ctx());

    insurance::mint_payer_cap(&cap, ORACLE, sc.ctx());

    sc.next_tx(ORACLE);
    {
        let payer = sc.take_from_address<insurance::InsurancePayerCap>(ORACLE);
        insurance::destroy_payer_cap_for_testing(payer);
    };

    admin::destroy_admin_cap_for_testing(cap);
    sc.end();
}
