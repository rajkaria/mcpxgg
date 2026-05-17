/// MCPX settlement — the atomic PTB that ties everything together. The
/// facilitator builds one transaction calling `settle_call`, which:
///
///   1. Asserts the platform isn't paused, the server is active, and the
///      vault belongs to the server's owner.
///   2. Asserts the tool exists on the server (the facilitator may charge a
///      different price than the on-chain price for free-tier or volume
///      discounts, so we don't compare amounts — only tool existence).
///   3. Debits the user's session by `amount_atomic` (which enforces caps,
///      scope, expiry, and balance).
///   4. Splits the debited Balance three ways:
///        - insurance_share = amount * insurance_bps / 10_000
///        - treasury_share  = amount * (take_rate_bps - insurance_bps) / 10_000
///        - dev_share       = amount - insurance_share - treasury_share
///   5. Credits each pool / vault.
///   6. Mints a soulbound `CallReceipt` for the payer (`key` only, no `store`,
///      so it cannot be transferred after creation — ADR-005 permanent).
///   7. Emits `CallSettled`.
///
/// If any step fails, the entire PTB reverts: no one is paid, no receipt
/// is minted. That's the whole point.
module mcpx::settlement;

use mcpx::admin::{Self, PlatformConfig};
use mcpx::events;
use mcpx::insurance::{Self, InsurancePool};
use mcpx::intent::{Self, SpendingIntent};
use mcpx::registry::{Self, Server};
use mcpx::session::{Self, Session};
use mcpx::treasury::{Self, PlatformTreasury};
use mcpx::vault::{Self, DeveloperVault};
use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};

// ─── Errors ─────────────────────────────────────────────────────────────────

const E_SERVER_INACTIVE: u64 = 1;
const E_TOOL_NOT_FOUND: u64 = 2;
const E_VAULT_OWNER_MISMATCH: u64 = 3;
const E_AMOUNT_OVERFLOW: u64 = 4;
const E_INTENT_AGENT_MISMATCH: u64 = 5;
const E_ACTUAL_EXCEEDS_QUOTED: u64 = 6;
const E_RECEIPT_SUCCEEDED: u64 = 7;
const E_ALREADY_REFUNDED: u64 = 8;
const E_NOT_RECEIPT_PAYER: u64 = 9;

// ─── Receipt ────────────────────────────────────────────────────────────────

public struct CallReceipt has key {
    id: UID,
    payer: address,
    server_id: ID,
    session_id: ID,
    tool_name: vector<u8>,
    amount_atomic: u64,
    dev_share_atomic: u64,
    treasury_share_atomic: u64,
    insurance_share_atomic: u64,
    log_blob_id: vector<u8>,
    success: bool,
    settled_at_ms: u64,
    refunded: bool,
}

// ─── Settle ─────────────────────────────────────────────────────────────────

/// The PTB-friendly entrypoint. All shared objects passed by mutable reference
/// where required; the `Server` is read-only (we only check active + tool
/// existence, no mutation).
public fun settle_call<T>(
    config: &PlatformConfig,
    session: &mut Session<T>,
    server: &Server,
    vault: &mut DeveloperVault<T>,
    treasury: &mut PlatformTreasury<T>,
    insurance: &mut InsurancePool<T>,
    amount_atomic: u64,
    tool_name_bytes: vector<u8>,
    log_blob_id: vector<u8>,
    success: bool,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    settle_inner(
        config,
        session,
        server,
        vault,
        treasury,
        insurance,
        amount_atomic,
        tool_name_bytes,
        log_blob_id,
        success,
        clock,
        ctx,
    )
}

/// Intent-aware settlement. The agent named in the intent must be the session
/// payer (the gateway opens the session as the delegated agent). Settlement is
/// identical to `settle_call`; afterward we record the spend against the intent
/// so `IntentUsed` references the real, just-minted receipt id and the intent's
/// per-call / daily / scope / category policy is enforced.
public fun settle_call_with_intent<T>(
    config: &PlatformConfig,
    session: &mut Session<T>,
    server: &Server,
    vault: &mut DeveloperVault<T>,
    treasury: &mut PlatformTreasury<T>,
    insurance: &mut InsurancePool<T>,
    intent: &mut SpendingIntent,
    amount_atomic: u64,
    tool_name_bytes: vector<u8>,
    category_bytes: vector<u8>,
    log_blob_id: vector<u8>,
    success: bool,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    assert!(intent::agent(intent) == session::owner(session), E_INTENT_AGENT_MISMATCH);
    let server_id = object::id(server);
    let receipt_id = settle_inner(
        config,
        session,
        server,
        vault,
        treasury,
        insurance,
        amount_atomic,
        tool_name_bytes,
        log_blob_id,
        success,
        clock,
        ctx,
    );
    intent::record_spend(intent, server_id, amount_atomic, receipt_id, category_bytes, clock);
    receipt_id
}

/// Pay-per-output (x402 `upto`) settlement. The facilitator quotes a ceiling
/// `quoted_max_atomic` up front (used for the 402 challenge), but only the
/// actually-metered `actual_atomic` is debited from the session once the
/// stream closes. `actual_atomic <= quoted_max_atomic` is enforced; the unused
/// delta is never debited (the "refund" is implicit — the session keeps it).
/// `UptoFinalized` records the ceiling, the actual, and the unused delta so
/// indexers can show "quoted $0.05, paid $0.012".
public fun settle_call_upto<T>(
    config: &PlatformConfig,
    session: &mut Session<T>,
    server: &Server,
    vault: &mut DeveloperVault<T>,
    treasury: &mut PlatformTreasury<T>,
    insurance: &mut InsurancePool<T>,
    quoted_max_atomic: u64,
    actual_atomic: u64,
    tool_name_bytes: vector<u8>,
    log_blob_id: vector<u8>,
    success: bool,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    assert!(actual_atomic <= quoted_max_atomic, E_ACTUAL_EXCEEDS_QUOTED);
    let receipt_id = settle_inner(
        config,
        session,
        server,
        vault,
        treasury,
        insurance,
        actual_atomic,
        tool_name_bytes,
        log_blob_id,
        success,
        clock,
        ctx,
    );
    events::emit_upto_finalized(
        receipt_id,
        quoted_max_atomic,
        actual_atomic,
        quoted_max_atomic - actual_atomic,
        clock::timestamp_ms(clock),
    );
    receipt_id
}

/// Intent-aware pay-per-output settlement: identical to `settle_call_upto`
/// but records the actually-metered spend against the agent's `SpendingIntent`
/// (per-call cap, daily cap, scope, category all enforced on `actual_atomic`).
public fun settle_call_upto_with_intent<T>(
    config: &PlatformConfig,
    session: &mut Session<T>,
    server: &Server,
    vault: &mut DeveloperVault<T>,
    treasury: &mut PlatformTreasury<T>,
    insurance: &mut InsurancePool<T>,
    intent: &mut SpendingIntent,
    quoted_max_atomic: u64,
    actual_atomic: u64,
    tool_name_bytes: vector<u8>,
    category_bytes: vector<u8>,
    log_blob_id: vector<u8>,
    success: bool,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    assert!(actual_atomic <= quoted_max_atomic, E_ACTUAL_EXCEEDS_QUOTED);
    assert!(intent::agent(intent) == session::owner(session), E_INTENT_AGENT_MISMATCH);
    let server_id = object::id(server);
    let receipt_id = settle_inner(
        config,
        session,
        server,
        vault,
        treasury,
        insurance,
        actual_atomic,
        tool_name_bytes,
        log_blob_id,
        success,
        clock,
        ctx,
    );
    intent::record_spend(intent, server_id, actual_atomic, receipt_id, category_bytes, clock);
    events::emit_upto_finalized(
        receipt_id,
        quoted_max_atomic,
        actual_atomic,
        quoted_max_atomic - actual_atomic,
        clock::timestamp_ms(clock),
    );
    receipt_id
}

/// Permissionless insurance claim for a failed call. The payer holds the
/// soulbound `CallReceipt`; if it recorded `success == false` and has not yet
/// been refunded, they can reclaim the call cost from the `InsurancePool`,
/// capped at the pool balance. Sets `refunded = true` so a receipt can only be
/// claimed once. No cap/oracle needed — the soulbound receipt *is* the proof.
public fun claim_for_failed_call<T>(
    receipt: &mut CallReceipt,
    pool: &mut InsurancePool<T>,
    clock: &Clock,
    ctx: &mut TxContext,
): u64 {
    assert!(ctx.sender() == receipt.payer, E_NOT_RECEIPT_PAYER);
    assert!(!receipt.success, E_RECEIPT_SUCCEEDED);
    assert!(!receipt.refunded, E_ALREADY_REFUNDED);

    let pool_balance = insurance::balance_value(pool);
    let payout = if (receipt.amount_atomic <= pool_balance) {
        receipt.amount_atomic
    } else {
        pool_balance
    };

    receipt.refunded = true;
    if (payout > 0) {
        insurance::pay_claim(pool, payout, receipt.payer, ctx);
    };
    events::emit_refund_issued(
        object::uid_to_inner(&receipt.id),
        payout,
        clock::timestamp_ms(clock),
    );
    payout
}

fun settle_inner<T>(
    config: &PlatformConfig,
    session: &mut Session<T>,
    server: &Server,
    vault: &mut DeveloperVault<T>,
    treasury: &mut PlatformTreasury<T>,
    insurance: &mut InsurancePool<T>,
    amount_atomic: u64,
    tool_name_bytes: vector<u8>,
    log_blob_id: vector<u8>,
    success: bool,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    admin::assert_not_paused(config);
    assert!(registry::is_active(server), E_SERVER_INACTIVE);
    assert!(registry::has_tool(server, tool_name_bytes), E_TOOL_NOT_FOUND);
    assert!(vault::owner(vault) == registry::owner(server), E_VAULT_OWNER_MISMATCH);

    let server_id = object::id(server);
    let session_id = object::id(session);
    let payer = session::owner(session);
    let now = clock::timestamp_ms(clock);

    // Compute splits in u128 to avoid overflow.
    let take_bps = (admin::take_rate_bps(config) as u128);
    let insurance_bps_u128 = (admin::insurance_bps(config) as u128);
    let amount_u128 = (amount_atomic as u128);

    let total_take_u128 = (amount_u128 * take_bps) / 10_000u128;
    let insurance_u128 = (amount_u128 * insurance_bps_u128) / 10_000u128;
    let treasury_u128 = total_take_u128 - insurance_u128;
    let dev_u128 = amount_u128 - total_take_u128;

    // u128 → u64 cast safety: a u64 input × a u16 bps / 10000 stays within u64.
    assert!(total_take_u128 <= (amount_atomic as u128), E_AMOUNT_OVERFLOW);
    let insurance_share = (insurance_u128 as u64);
    let treasury_share = (treasury_u128 as u64);
    let dev_share = (dev_u128 as u64);

    // Debit the session — this enforces caps, scope, expiry, and balance.
    let mut payment: Balance<T> = session::debit(session, amount_atomic, server_id, clock);

    // Three-way split. balance::split aborts if insufficient — the math above
    // guarantees insurance_share + treasury_share + dev_share == amount_atomic.
    if (insurance_share > 0) {
        let insurance_bal = balance::split(&mut payment, insurance_share);
        insurance::collect(insurance, insurance_bal);
    };
    if (treasury_share > 0) {
        let treasury_bal = balance::split(&mut payment, treasury_share);
        treasury::collect(treasury, treasury_bal);
    };
    if (dev_share > 0) {
        // payment now holds exactly dev_share
        vault::accrue(vault, payment);
    } else {
        // amount_atomic was 0 → payment is empty; destroy.
        balance::destroy_zero(payment);
    };

    // Mint soulbound receipt
    let receipt = CallReceipt {
        id: object::new(ctx),
        payer,
        server_id,
        session_id,
        tool_name: tool_name_bytes,
        amount_atomic,
        dev_share_atomic: dev_share,
        treasury_share_atomic: treasury_share,
        insurance_share_atomic: insurance_share,
        log_blob_id,
        success,
        settled_at_ms: now,
        refunded: false,
    };
    let receipt_id = object::id(&receipt);

    events::emit_call_settled(
        receipt_id,
        server_id,
        payer,
        receipt.tool_name,
        amount_atomic,
        dev_share,
        treasury_share,
        insurance_share,
        receipt.log_blob_id,
        success,
        now,
    );

    transfer::transfer(receipt, payer);
    receipt_id
}

// Refund flow: deferred to Sprint 2. The `refunded` field on CallReceipt
// is reserved for the eventual implementation; it stays `false` here.
// See docs/SPRINTS.md S2 for the planned refund mechanism via insurance pool.

// ─── Read accessors ─────────────────────────────────────────────────────────

public fun receipt_payer(r: &CallReceipt): address { r.payer }

public fun receipt_server_id(r: &CallReceipt): ID { r.server_id }

public fun receipt_session_id(r: &CallReceipt): ID { r.session_id }

public fun receipt_amount(r: &CallReceipt): u64 { r.amount_atomic }

public fun receipt_dev_share(r: &CallReceipt): u64 { r.dev_share_atomic }

public fun receipt_treasury_share(r: &CallReceipt): u64 { r.treasury_share_atomic }

public fun receipt_insurance_share(r: &CallReceipt): u64 { r.insurance_share_atomic }

public fun receipt_success(r: &CallReceipt): bool { r.success }

public fun receipt_refunded(r: &CallReceipt): bool { r.refunded }

public fun receipt_log_blob_id(r: &CallReceipt): &vector<u8> { &r.log_blob_id }

public fun receipt_tool_name(r: &CallReceipt): &vector<u8> { &r.tool_name }

public fun receipt_settled_at_ms(r: &CallReceipt): u64 { r.settled_at_ms }

// ─── Test helpers ───────────────────────────────────────────────────────────

#[test_only]
public fun take_receipt_from(receipt: CallReceipt): (
    address, ID, ID, u64, u64, u64, u64, bool, bool, u64
) {
    let CallReceipt {
        id,
        payer,
        server_id,
        session_id,
        tool_name: _,
        amount_atomic,
        dev_share_atomic,
        treasury_share_atomic,
        insurance_share_atomic,
        log_blob_id: _,
        success,
        settled_at_ms,
        refunded,
    } = receipt;
    object::delete(id);
    (
        payer,
        server_id,
        session_id,
        amount_atomic,
        dev_share_atomic,
        treasury_share_atomic,
        insurance_share_atomic,
        success,
        refunded,
        settled_at_ms,
    )
}

#[test_only]
public fun destroy_receipt_for_testing(receipt: CallReceipt) {
    let CallReceipt { id, .. } = receipt;
    object::delete(id);
}
