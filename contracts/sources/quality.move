/// MCPX quality oracle attestations. The off-chain oracle observes uptime,
/// latency, and error rates per server, then mints `QualityAttestation`
/// objects on-chain. Attestations are shared so other modules / dApps can
/// query them; the staking module reads them to decide on slashing
/// (Sprint 7).
///
/// Authority is gated by `OracleCap`. Multiple oracles can hold caps
/// simultaneously (multi-attestor).
module mcpx::quality;

use mcpx::admin::AdminCap;
use mcpx::events;
use sui::clock::{Self, Clock};

const E_INVALID_SCORE: u64 = 1;
const E_INVALID_WINDOW: u64 = 2;

/// Authority to publish attestations. Held by oracle service(s).
public struct OracleCap has key, store {
    id: UID,
}

public struct QualityAttestation has key {
    id: UID,
    server_id: ID,
    /// Composite quality score (0..10000 = 0–100.00%).
    score_x100: u32,
    uptime_x100: u32,
    p95_latency_ms: u32,
    error_rate_x100: u32,
    sample_count: u64,
    window_start_ms: u64,
    window_end_ms: u64,
    attested_by: address,
    attested_at_ms: u64,
}

public fun mint_oracle_cap(_: &AdminCap, recipient: address, ctx: &mut TxContext) {
    let cap = OracleCap { id: object::new(ctx) };
    transfer::transfer(cap, recipient);
}

public fun attest(
    _: &OracleCap,
    server_id: ID,
    score_x100: u32,
    uptime_x100: u32,
    p95_latency_ms: u32,
    error_rate_x100: u32,
    sample_count: u64,
    window_start_ms: u64,
    window_end_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    assert!(score_x100 <= 10_000, E_INVALID_SCORE);
    assert!(uptime_x100 <= 10_000, E_INVALID_SCORE);
    assert!(error_rate_x100 <= 10_000, E_INVALID_SCORE);
    assert!(window_end_ms > window_start_ms, E_INVALID_WINDOW);
    let now = clock::timestamp_ms(clock);

    let attestation = QualityAttestation {
        id: object::new(ctx),
        server_id,
        score_x100,
        uptime_x100,
        p95_latency_ms,
        error_rate_x100,
        sample_count,
        window_start_ms,
        window_end_ms,
        attested_by: ctx.sender(),
        attested_at_ms: now,
    };
    let attestation_id = object::id(&attestation);
    events::emit_quality_attested(
        attestation_id,
        server_id,
        score_x100,
        uptime_x100,
        p95_latency_ms,
        error_rate_x100,
        sample_count,
        now,
    );
    transfer::share_object(attestation);
    attestation_id
}

// ─── Read accessors ─────────────────────────────────────────────────────────

public fun server_id(a: &QualityAttestation): ID { a.server_id }

public fun score_x100(a: &QualityAttestation): u32 { a.score_x100 }

public fun uptime_x100(a: &QualityAttestation): u32 { a.uptime_x100 }

public fun p95_latency_ms(a: &QualityAttestation): u32 { a.p95_latency_ms }

public fun error_rate_x100(a: &QualityAttestation): u32 { a.error_rate_x100 }

public fun sample_count(a: &QualityAttestation): u64 { a.sample_count }

public fun window_start_ms(a: &QualityAttestation): u64 { a.window_start_ms }

public fun window_end_ms(a: &QualityAttestation): u64 { a.window_end_ms }

public fun attested_by(a: &QualityAttestation): address { a.attested_by }

public fun attested_at_ms(a: &QualityAttestation): u64 { a.attested_at_ms }

// ─── Test helpers ───────────────────────────────────────────────────────────

#[test_only]
public fun mint_oracle_cap_for_testing(ctx: &mut TxContext): OracleCap {
    OracleCap { id: object::new(ctx) }
}

#[test_only]
public fun destroy_oracle_cap_for_testing(c: OracleCap) {
    let OracleCap { id } = c;
    object::delete(id);
}
