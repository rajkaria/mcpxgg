/// MCPX admin / platform configuration.
///
/// Holds the on-chain knobs the SPRINTS plan requires to be mutable post-deploy:
///   - `take_rate_bps` (default 250 = 2.5%) — total platform take per call
///   - `insurance_bps` (default 50 = 0.5%)  — subset of take routed to InsurancePool
///   - treasury share is implicitly `take_rate_bps - insurance_bps` (default 200 bps)
///   - `subsidy_atomic` (default 1_000_000) — per-user bootstrap grant in USDsui units
///   - `sla_min_stake_atomic` — minimum SLA stake for the staking module (Sprint 7)
///   - `paused` — circuit-breaker that other modules read via `assert_not_paused`
///
/// Mutations gated by `AdminCap`, which is held by an admin multisig in production
/// (per ADR-004). The cap is `key + store` so it can be transferred to a multisig
/// address after deploy.
module mcpx::admin;

use mcpx::events;
use sui::clock::{Self, Clock};

// ─── Errors ─────────────────────────────────────────────────────────────────

const E_INVALID_BPS: u64 = 1;
const E_INSURANCE_EXCEEDS_TAKE: u64 = 2;
const E_PAUSED: u64 = 3;

// ─── Constants ──────────────────────────────────────────────────────────────

/// Hard cap of 10% — protects users even from admin-multisig misconfig.
const MAX_TAKE_RATE_BPS: u16 = 1000;
const DEFAULT_TAKE_RATE_BPS: u16 = 250; // 2.5%
const DEFAULT_INSURANCE_BPS: u16 = 50; // 0.5%
const DEFAULT_SUBSIDY_ATOMIC: u64 = 1_000_000; // 1.00 USDsui (6 decimals)
const DEFAULT_SLA_MIN_STAKE_ATOMIC: u64 = 10_000_000; // 10.00 USDsui

// ─── Objects ────────────────────────────────────────────────────────────────

public struct AdminCap has key, store {
    id: UID,
}

public struct PlatformConfig has key {
    id: UID,
    take_rate_bps: u16,
    insurance_bps: u16,
    subsidy_atomic: u64,
    sla_min_stake_atomic: u64,
    paused: bool,
    version: u64,
}

// ─── Init ───────────────────────────────────────────────────────────────────

fun init(ctx: &mut TxContext) {
    let cap = AdminCap { id: object::new(ctx) };
    let config = PlatformConfig {
        id: object::new(ctx),
        take_rate_bps: DEFAULT_TAKE_RATE_BPS,
        insurance_bps: DEFAULT_INSURANCE_BPS,
        subsidy_atomic: DEFAULT_SUBSIDY_ATOMIC,
        sla_min_stake_atomic: DEFAULT_SLA_MIN_STAKE_ATOMIC,
        paused: false,
        version: 1,
    };
    transfer::transfer(cap, ctx.sender());
    transfer::share_object(config);
}

// ─── Read accessors ─────────────────────────────────────────────────────────

public fun take_rate_bps(c: &PlatformConfig): u16 { c.take_rate_bps }

public fun insurance_bps(c: &PlatformConfig): u16 { c.insurance_bps }

public fun treasury_bps(c: &PlatformConfig): u16 { c.take_rate_bps - c.insurance_bps }

public fun subsidy_atomic(c: &PlatformConfig): u64 { c.subsidy_atomic }

public fun sla_min_stake_atomic(c: &PlatformConfig): u64 { c.sla_min_stake_atomic }

public fun is_paused(c: &PlatformConfig): bool { c.paused }

public fun version(c: &PlatformConfig): u64 { c.version }

public fun assert_not_paused(c: &PlatformConfig) {
    assert!(!c.paused, E_PAUSED);
}

// ─── Admin mutations (cap-gated) ────────────────────────────────────────────

public fun set_take_rate(
    _: &AdminCap,
    config: &mut PlatformConfig,
    new_take_bps: u16,
    new_insurance_bps: u16,
) {
    assert!(new_take_bps <= MAX_TAKE_RATE_BPS, E_INVALID_BPS);
    assert!(new_insurance_bps <= new_take_bps, E_INSURANCE_EXCEEDS_TAKE);
    config.take_rate_bps = new_take_bps;
    config.insurance_bps = new_insurance_bps;
    events::emit_config_updated(new_take_bps, new_insurance_bps, config.subsidy_atomic);
}

public fun set_subsidy(_: &AdminCap, config: &mut PlatformConfig, new_atomic: u64) {
    config.subsidy_atomic = new_atomic;
    events::emit_config_updated(config.take_rate_bps, config.insurance_bps, new_atomic);
}

public fun set_sla_min_stake(_: &AdminCap, config: &mut PlatformConfig, new_atomic: u64) {
    config.sla_min_stake_atomic = new_atomic;
}

public fun set_paused(
    _: &AdminCap,
    config: &mut PlatformConfig,
    paused: bool,
    clock: &Clock,
) {
    config.paused = paused;
    events::emit_config_paused(paused, clock::timestamp_ms(clock));
}

// ─── Test helpers ───────────────────────────────────────────────────────────

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

#[test_only]
public fun max_take_rate_bps_for_testing(): u16 { MAX_TAKE_RATE_BPS }

#[test_only]
public fun mint_admin_cap_for_testing(ctx: &mut TxContext): AdminCap {
    AdminCap { id: object::new(ctx) }
}

#[test_only]
public fun new_config_for_testing(ctx: &mut TxContext): PlatformConfig {
    PlatformConfig {
        id: object::new(ctx),
        take_rate_bps: DEFAULT_TAKE_RATE_BPS,
        insurance_bps: DEFAULT_INSURANCE_BPS,
        subsidy_atomic: DEFAULT_SUBSIDY_ATOMIC,
        sla_min_stake_atomic: DEFAULT_SLA_MIN_STAKE_ATOMIC,
        paused: false,
        version: 1,
    }
}

#[test_only]
public fun destroy_admin_cap_for_testing(cap: AdminCap) {
    let AdminCap { id } = cap;
    object::delete(id);
}

#[test_only]
public fun destroy_config_for_testing(config: PlatformConfig) {
    let PlatformConfig { id, .. } = config;
    object::delete(id);
}
