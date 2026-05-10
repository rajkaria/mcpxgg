/// MCPX root module — placeholder.
///
/// Sprint 1 (docs/SPRINTS.md, S1-T01..T17) replaces this with the full
/// 13-module package: registry, session, settlement, vault, treasury,
/// access, intent, staking, insurance, bundle, quality, events, admin.
///
/// This stub exists only so `sui move build` succeeds during Sprint 0.
module mcpx::mcpx {
    public struct Placeholder has drop {
        version: u64,
    }

    public fun version(): u64 {
        1
    }
}
