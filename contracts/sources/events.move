/// MCPX events — every state transition emits a typed event so the indexer
/// can hydrate Postgres views (ADR-011: Postgres is a mirror, chain owns state).
///
/// All event structs are `copy + drop`. Other mcpx modules emit through the
/// `public(package)` helpers below; external packages cannot forge events.
module mcpx::events;

use sui::event;

// ─── Registry events ────────────────────────────────────────────────────────

public struct ServerPublished has copy, drop {
    server_id: ID,
    namespace: vector<u8>,
    owner: address,
    metadata_blob_id: vector<u8>,
    category: vector<u8>,
    timestamp_ms: u64,
}

public struct ServerUpdated has copy, drop {
    server_id: ID,
    version: u64,
    timestamp_ms: u64,
}

public struct ServerDeactivated has copy, drop {
    server_id: ID,
    timestamp_ms: u64,
}

public struct ToolAdded has copy, drop {
    server_id: ID,
    tool_name: vector<u8>,
    price_atomic: u64,
}

public struct ToolRemoved has copy, drop {
    server_id: ID,
    tool_name: vector<u8>,
}

// ─── Session events ─────────────────────────────────────────────────────────

public struct SessionCreated has copy, drop {
    session_id: ID,
    owner: address,
    initial_balance_atomic: u64,
    timestamp_ms: u64,
}

public struct SessionDeposit has copy, drop {
    session_id: ID,
    amount_atomic: u64,
    new_balance_atomic: u64,
}

public struct SessionWithdraw has copy, drop {
    session_id: ID,
    amount_atomic: u64,
    new_balance_atomic: u64,
}

public struct SessionLimitsUpdated has copy, drop {
    session_id: ID,
    per_call_cap_atomic: u64,
    per_day_cap_atomic: u64,
}

public struct SessionClosed has copy, drop {
    session_id: ID,
    refund_atomic: u64,
}

// ─── Settlement events ──────────────────────────────────────────────────────

public struct CallSettled has copy, drop {
    receipt_id: ID,
    server_id: ID,
    payer: address,
    tool_name: vector<u8>,
    amount_atomic: u64,
    dev_share_atomic: u64,
    treasury_share_atomic: u64,
    insurance_share_atomic: u64,
    log_blob_id: vector<u8>,
    success: bool,
    timestamp_ms: u64,
}

public struct RefundIssued has copy, drop {
    original_receipt_id: ID,
    refund_amount_atomic: u64,
    timestamp_ms: u64,
}

// ─── Vault events ───────────────────────────────────────────────────────────

public struct VaultCreated has copy, drop {
    vault_id: ID,
    owner: address,
}

public struct VaultAccrued has copy, drop {
    vault_id: ID,
    amount_atomic: u64,
    new_balance_atomic: u64,
    lifetime_earnings_atomic: u64,
}

public struct VaultClaimed has copy, drop {
    vault_id: ID,
    owner: address,
    amount_atomic: u64,
    timestamp_ms: u64,
}

// ─── Treasury events ────────────────────────────────────────────────────────

public struct TreasuryCollected has copy, drop {
    amount_atomic: u64,
    lifetime_collected_atomic: u64,
}

public struct TreasuryWithdrawn has copy, drop {
    amount_atomic: u64,
    recipient: address,
    timestamp_ms: u64,
}

// ─── Insurance events ───────────────────────────────────────────────────────

public struct InsuranceCollected has copy, drop {
    amount_atomic: u64,
    lifetime_collected_atomic: u64,
}

public struct InsurancePaid has copy, drop {
    amount_atomic: u64,
    recipient: address,
    reason: vector<u8>,
    timestamp_ms: u64,
}

// ─── Admin / config events ──────────────────────────────────────────────────

public struct ConfigUpdated has copy, drop {
    take_rate_bps: u16,
    insurance_bps: u16,
    subsidy_atomic: u64,
}

public struct ConfigPaused has copy, drop {
    paused: bool,
    timestamp_ms: u64,
}

// ─── Quality events ─────────────────────────────────────────────────────────

public struct QualityAttested has copy, drop {
    attestation_id: ID,
    server_id: ID,
    score_x100: u32,
    uptime_x100: u32,
    p95_latency_ms: u32,
    error_rate_x100: u32,
    sample_count: u64,
    timestamp_ms: u64,
}

// ─── Stubs for later sprints (S5–S7, S16) ───────────────────────────────────

public struct IntentCreated has copy, drop {
    intent_id: ID,
    user: address,
    agent: address,
    daily_cap_atomic: u64,
    expires_at_ms: u64,
}

public struct IntentRevoked has copy, drop {
    intent_id: ID,
    timestamp_ms: u64,
}

public struct IntentUsed has copy, drop {
    intent_id: ID,
    receipt_id: ID,
    amount_atomic: u64,
}

public struct StakePosted has copy, drop {
    stake_id: ID,
    server_id: ID,
    owner: address,
    amount_atomic: u64,
    sla_uptime_x100: u32,
}

public struct StakeSlashed has copy, drop {
    stake_id: ID,
    server_id: ID,
    amount_atomic: u64,
    reason: vector<u8>,
    timestamp_ms: u64,
}

public struct BundleCreated has copy, drop {
    bundle_id: ID,
    creator: address,
    server_count: u64,
    price_multiplier_x100: u32,
}

public struct BundleActivated has copy, drop {
    bundle_id: ID,
    user: address,
    timestamp_ms: u64,
}

public struct ReviewPosted has copy, drop {
    review_id: ID,
    server_id: ID,
    reviewer: address,
    rating_x10: u8,
}

// ─── Emit helpers — public(package), only mcpx modules can call ─────────────

public(package) fun emit_server_published(
    server_id: ID,
    namespace: vector<u8>,
    owner: address,
    metadata_blob_id: vector<u8>,
    category: vector<u8>,
    timestamp_ms: u64,
) {
    event::emit(ServerPublished {
        server_id,
        namespace,
        owner,
        metadata_blob_id,
        category,
        timestamp_ms,
    });
}

public(package) fun emit_server_updated(server_id: ID, version: u64, timestamp_ms: u64) {
    event::emit(ServerUpdated { server_id, version, timestamp_ms });
}

public(package) fun emit_server_deactivated(server_id: ID, timestamp_ms: u64) {
    event::emit(ServerDeactivated { server_id, timestamp_ms });
}

public(package) fun emit_tool_added(server_id: ID, tool_name: vector<u8>, price_atomic: u64) {
    event::emit(ToolAdded { server_id, tool_name, price_atomic });
}

public(package) fun emit_tool_removed(server_id: ID, tool_name: vector<u8>) {
    event::emit(ToolRemoved { server_id, tool_name });
}

public(package) fun emit_session_created(
    session_id: ID,
    owner: address,
    initial_balance_atomic: u64,
    timestamp_ms: u64,
) {
    event::emit(SessionCreated {
        session_id,
        owner,
        initial_balance_atomic,
        timestamp_ms,
    });
}

public(package) fun emit_session_deposit(
    session_id: ID,
    amount_atomic: u64,
    new_balance_atomic: u64,
) {
    event::emit(SessionDeposit { session_id, amount_atomic, new_balance_atomic });
}

public(package) fun emit_session_withdraw(
    session_id: ID,
    amount_atomic: u64,
    new_balance_atomic: u64,
) {
    event::emit(SessionWithdraw { session_id, amount_atomic, new_balance_atomic });
}

public(package) fun emit_session_limits_updated(
    session_id: ID,
    per_call_cap_atomic: u64,
    per_day_cap_atomic: u64,
) {
    event::emit(SessionLimitsUpdated {
        session_id,
        per_call_cap_atomic,
        per_day_cap_atomic,
    });
}

public(package) fun emit_session_closed(session_id: ID, refund_atomic: u64) {
    event::emit(SessionClosed { session_id, refund_atomic });
}

public(package) fun emit_call_settled(
    receipt_id: ID,
    server_id: ID,
    payer: address,
    tool_name: vector<u8>,
    amount_atomic: u64,
    dev_share_atomic: u64,
    treasury_share_atomic: u64,
    insurance_share_atomic: u64,
    log_blob_id: vector<u8>,
    success: bool,
    timestamp_ms: u64,
) {
    event::emit(CallSettled {
        receipt_id,
        server_id,
        payer,
        tool_name,
        amount_atomic,
        dev_share_atomic,
        treasury_share_atomic,
        insurance_share_atomic,
        log_blob_id,
        success,
        timestamp_ms,
    });
}

public(package) fun emit_refund_issued(
    original_receipt_id: ID,
    refund_amount_atomic: u64,
    timestamp_ms: u64,
) {
    event::emit(RefundIssued {
        original_receipt_id,
        refund_amount_atomic,
        timestamp_ms,
    });
}

public(package) fun emit_vault_created(vault_id: ID, owner: address) {
    event::emit(VaultCreated { vault_id, owner });
}

public(package) fun emit_vault_accrued(
    vault_id: ID,
    amount_atomic: u64,
    new_balance_atomic: u64,
    lifetime_earnings_atomic: u64,
) {
    event::emit(VaultAccrued {
        vault_id,
        amount_atomic,
        new_balance_atomic,
        lifetime_earnings_atomic,
    });
}

public(package) fun emit_vault_claimed(
    vault_id: ID,
    owner: address,
    amount_atomic: u64,
    timestamp_ms: u64,
) {
    event::emit(VaultClaimed { vault_id, owner, amount_atomic, timestamp_ms });
}

public(package) fun emit_treasury_collected(amount_atomic: u64, lifetime_collected_atomic: u64) {
    event::emit(TreasuryCollected { amount_atomic, lifetime_collected_atomic });
}

public(package) fun emit_treasury_withdrawn(
    amount_atomic: u64,
    recipient: address,
    timestamp_ms: u64,
) {
    event::emit(TreasuryWithdrawn { amount_atomic, recipient, timestamp_ms });
}

public(package) fun emit_insurance_collected(amount_atomic: u64, lifetime_collected_atomic: u64) {
    event::emit(InsuranceCollected { amount_atomic, lifetime_collected_atomic });
}

public(package) fun emit_insurance_paid(
    amount_atomic: u64,
    recipient: address,
    reason: vector<u8>,
    timestamp_ms: u64,
) {
    event::emit(InsurancePaid { amount_atomic, recipient, reason, timestamp_ms });
}

public(package) fun emit_config_updated(
    take_rate_bps: u16,
    insurance_bps: u16,
    subsidy_atomic: u64,
) {
    event::emit(ConfigUpdated {
        take_rate_bps,
        insurance_bps,
        subsidy_atomic,
    });
}

public(package) fun emit_config_paused(paused: bool, timestamp_ms: u64) {
    event::emit(ConfigPaused { paused, timestamp_ms });
}

public(package) fun emit_quality_attested(
    attestation_id: ID,
    server_id: ID,
    score_x100: u32,
    uptime_x100: u32,
    p95_latency_ms: u32,
    error_rate_x100: u32,
    sample_count: u64,
    timestamp_ms: u64,
) {
    event::emit(QualityAttested {
        attestation_id,
        server_id,
        score_x100,
        uptime_x100,
        p95_latency_ms,
        error_rate_x100,
        sample_count,
        timestamp_ms,
    });
}

public(package) fun emit_intent_created(
    intent_id: ID,
    user: address,
    agent: address,
    daily_cap_atomic: u64,
    expires_at_ms: u64,
) {
    event::emit(IntentCreated {
        intent_id,
        user,
        agent,
        daily_cap_atomic,
        expires_at_ms,
    });
}

public(package) fun emit_intent_revoked(intent_id: ID, timestamp_ms: u64) {
    event::emit(IntentRevoked { intent_id, timestamp_ms });
}

public(package) fun emit_intent_used(intent_id: ID, receipt_id: ID, amount_atomic: u64) {
    event::emit(IntentUsed { intent_id, receipt_id, amount_atomic });
}

public(package) fun emit_stake_posted(
    stake_id: ID,
    server_id: ID,
    owner: address,
    amount_atomic: u64,
    sla_uptime_x100: u32,
) {
    event::emit(StakePosted {
        stake_id,
        server_id,
        owner,
        amount_atomic,
        sla_uptime_x100,
    });
}

public(package) fun emit_stake_slashed(
    stake_id: ID,
    server_id: ID,
    amount_atomic: u64,
    reason: vector<u8>,
    timestamp_ms: u64,
) {
    event::emit(StakeSlashed {
        stake_id,
        server_id,
        amount_atomic,
        reason,
        timestamp_ms,
    });
}

public(package) fun emit_bundle_created(
    bundle_id: ID,
    creator: address,
    server_count: u64,
    price_multiplier_x100: u32,
) {
    event::emit(BundleCreated {
        bundle_id,
        creator,
        server_count,
        price_multiplier_x100,
    });
}

public(package) fun emit_bundle_activated(bundle_id: ID, user: address, timestamp_ms: u64) {
    event::emit(BundleActivated { bundle_id, user, timestamp_ms });
}

public(package) fun emit_review_posted(
    review_id: ID,
    server_id: ID,
    reviewer: address,
    rating_x10: u8,
) {
    event::emit(ReviewPosted { review_id, server_id, reviewer, rating_x10 });
}
