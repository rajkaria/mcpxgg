/// MCPX server SLA staking — Tier-A feature A3, expanded in Sprint 7.
///
/// Developer locks USDsui as collateral against a stated SLA tier. If the
/// quality oracle observes uptime / error-rate breach, an `OracleCap`
/// holder can call `slash`, routing the slashed amount to the
/// `InsurancePool`. Sprint 1 ships the storage type, post + withdraw;
/// the slashing predicate (oracle integration) lands in Sprint 7.
module mcpx::staking;

use mcpx::admin::PlatformConfig;
use mcpx::admin;
use mcpx::events;
use mcpx::insurance::{Self, InsurancePool};
use mcpx::quality::{Self, OracleCap, QualityAttestation};
use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};

const E_NOT_OWNER: u64 = 1;
const E_BELOW_MINIMUM: u64 = 2;
const E_INSUFFICIENT_STAKE: u64 = 3;
const E_INVALID_SLA: u64 = 4;
const E_LOCKED: u64 = 5;
const E_ATTESTATION_SERVER_MISMATCH: u64 = 6;
const E_NO_SLA_BREACH: u64 = 7;
const E_STALE_ATTESTATION: u64 = 8;

/// An attestation older than `freshness = sla_window_seconds × 3` (covering the
/// oracle's ≥2-window breach rule plus slack) cannot justify a slash — this
/// stops an OracleCap holder replaying a long-stale breach.
const SLASH_ATTESTATION_FRESHNESS_WINDOWS: u64 = 3;

public struct ServerStake<phantom T> has key {
    id: UID,
    server_id: ID,
    owner: address,
    stake: Balance<T>,
    sla_uptime_x100: u32,
    sla_window_seconds: u64,
    /// Funds cannot be withdrawn before this timestamp. Lets oracles slash
    /// stake even if the developer tries to bail before an attestation lands.
    locked_until_ms: u64,
    lifetime_slashed_atomic: u64,
}

public fun post<T>(
    config: &PlatformConfig,
    server_id: ID,
    deposit: Coin<T>,
    sla_uptime_x100: u32,
    sla_window_seconds: u64,
    lock_duration_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    let amount = coin::value(&deposit);
    assert!(amount >= admin::sla_min_stake_atomic(config), E_BELOW_MINIMUM);
    assert!(sla_uptime_x100 > 0 && sla_uptime_x100 <= 10_000, E_INVALID_SLA);
    let owner = ctx.sender();
    let stake = ServerStake<T> {
        id: object::new(ctx),
        server_id,
        owner,
        stake: coin::into_balance(deposit),
        sla_uptime_x100,
        sla_window_seconds,
        locked_until_ms: clock::timestamp_ms(clock) + lock_duration_ms,
        lifetime_slashed_atomic: 0,
    };
    let stake_id = object::id(&stake);
    events::emit_stake_posted(stake_id, server_id, owner, amount, sla_uptime_x100);
    transfer::share_object(stake);
    stake_id
}

public fun top_up<T>(stake: &mut ServerStake<T>, deposit: Coin<T>, ctx: &TxContext) {
    assert!(stake.owner == ctx.sender(), E_NOT_OWNER);
    let amount = coin::value(&deposit);
    balance::join(&mut stake.stake, coin::into_balance(deposit));
    events::emit_stake_posted(
        object::id(stake),
        stake.server_id,
        stake.owner,
        amount,
        stake.sla_uptime_x100,
    );
}

public fun withdraw<T>(
    stake: &mut ServerStake<T>,
    amount: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(stake.owner == ctx.sender(), E_NOT_OWNER);
    assert!(clock::timestamp_ms(clock) >= stake.locked_until_ms, E_LOCKED);
    assert!(balance::value(&stake.stake) >= amount, E_INSUFFICIENT_STAKE);
    let coin = coin::from_balance(balance::split(&mut stake.stake, amount), ctx);
    transfer::public_transfer(coin, stake.owner);
}

/// Slash a portion of the stake, routed to the `InsurancePool`. Gated on BOTH
/// an `OracleCap` AND a `QualityAttestation` that on-chain proves the breach:
///   - the attestation is for *this* stake's server,
///   - its observed `uptime_x100` is strictly below the committed SLA, and
///   - it is fresh (attested within `sla_window_seconds × 3` of `clock`),
/// so a cap holder cannot slash an in-SLA server or replay a stale breach.
/// The proportional slash *amount* is computed off-chain by the oracle from
/// the shortfall magnitude; the chain bounds it to the available stake.
public fun slash<T>(
    _: &OracleCap,
    stake: &mut ServerStake<T>,
    pool: &mut InsurancePool<T>,
    attestation: &QualityAttestation,
    amount: u64,
    reason: vector<u8>,
    clock: &Clock,
) {
    assert!(
        quality::server_id(attestation) == stake.server_id,
        E_ATTESTATION_SERVER_MISMATCH,
    );
    assert!(
        quality::uptime_x100(attestation) < stake.sla_uptime_x100,
        E_NO_SLA_BREACH,
    );
    let now = clock::timestamp_ms(clock);
    let freshness_ms =
        stake.sla_window_seconds * SLASH_ATTESTATION_FRESHNESS_WINDOWS * 1_000;
    assert!(
        now <= quality::attested_at_ms(attestation) + freshness_ms,
        E_STALE_ATTESTATION,
    );
    assert!(balance::value(&stake.stake) >= amount, E_INSUFFICIENT_STAKE);
    let slashed = balance::split(&mut stake.stake, amount);
    insurance::collect(pool, slashed);
    stake.lifetime_slashed_atomic = stake.lifetime_slashed_atomic + amount;
    events::emit_stake_slashed(
        object::id(stake),
        stake.server_id,
        amount,
        reason,
        clock::timestamp_ms(clock),
    );
}

// ─── Read accessors ─────────────────────────────────────────────────────────

public fun owner<T>(s: &ServerStake<T>): address { s.owner }

public fun server_id<T>(s: &ServerStake<T>): ID { s.server_id }

public fun amount<T>(s: &ServerStake<T>): u64 { balance::value(&s.stake) }

public fun sla_uptime_x100<T>(s: &ServerStake<T>): u32 { s.sla_uptime_x100 }

public fun sla_window_seconds<T>(s: &ServerStake<T>): u64 { s.sla_window_seconds }

public fun locked_until_ms<T>(s: &ServerStake<T>): u64 { s.locked_until_ms }

public fun lifetime_slashed<T>(s: &ServerStake<T>): u64 { s.lifetime_slashed_atomic }
