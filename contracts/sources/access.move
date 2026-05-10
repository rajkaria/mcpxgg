/// MCPX scoped access keys — Sprint 4 wires these to API key derivation
/// (rebinding an HMAC API key to an on-chain SessionKey + scope).
///
/// Sprint 1 ships the type so the registry / session events can reference
/// it without a forward dependency, but `mint_scoped_key` is gated only by
/// the session owner; finer-grained delegation lands in S4.
module mcpx::access;

use mcpx::session::{Self, Session};

const E_NOT_SESSION_OWNER: u64 = 1;
const E_INVALID_EXPIRY: u64 = 2;

public struct ScopedKey has key, store {
    id: UID,
    session_id: ID,
    server_ids: vector<ID>,
    expires_at_ms: u64,
    revoked: bool,
}

public fun mint_scoped_key<T>(
    session: &Session<T>,
    server_ids: vector<ID>,
    expires_at_ms: u64,
    ctx: &mut TxContext,
): ScopedKey {
    assert!(session::owner(session) == ctx.sender(), E_NOT_SESSION_OWNER);
    assert!(expires_at_ms > 0, E_INVALID_EXPIRY);
    ScopedKey {
        id: object::new(ctx),
        session_id: object::id(session),
        server_ids,
        expires_at_ms,
        revoked: false,
    }
}

public fun revoke(key: &mut ScopedKey, ctx: &TxContext) {
    let _ = ctx;
    key.revoked = true;
}

public fun session_id(k: &ScopedKey): ID { k.session_id }

public fun server_ids(k: &ScopedKey): &vector<ID> { &k.server_ids }

public fun expires_at_ms(k: &ScopedKey): u64 { k.expires_at_ms }

public fun is_revoked(k: &ScopedKey): bool { k.revoked }

#[test_only]
public fun destroy_for_testing(k: ScopedKey) {
    let ScopedKey { id, .. } = k;
    object::delete(id);
}
