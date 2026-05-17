# Building an autonomous agent that uses MCPX

This guide walks through giving an autonomous agent a **capped, revocable
budget** with a [`SpendingIntent`](https://mcpx.gg), then driving paid MCP
tool calls through `@mcpxgg/sdk` until the owner pulls the plug.

> A spending intent is an on-chain delegation: *"this agent address may spend
> up to this much, on these categories, on these servers, until this time."*
> Every call still settles atomically in USDsui and mints a permanent
> `CallReceipt` — the intent just adds agent-scoped policy on top of the
> session. The gateway pre-checks the policy and the
> `mcpx::settlement::settle_call_with_intent` Move entrypoint re-enforces it
> atomically, so the chain is always the source of truth.

---

## 1. Create a SpendingIntent

An intent is a Sui object created by the **user** (the budget owner) and
handed to an **agent** (the address that will do the spending). Create it from
the [Intent Manager](https://mcpx.gg) UI, or directly with a Move call:

```
mcpx::intent::create(
  agent,                 // address — who may spend (the agent's wallet)
  daily_cap_atomic,      // u64    — max USDsui atomic spent per UTC day (0 = no cap)
  per_call_cap_atomic,   // u64    — max USDsui atomic per single call (0 = no cap)
  server_ids,            // vector<ID>          — allowed servers ([] = any)
  allowed_categories,    // vector<vector<u8>>  — allowed categories ([] = any)
  expires_at_ms,         // u64    — unix ms after which it's dead (0 = never)
  clock, ctx,
)
```

What each field means for the agent:

| Field                | Meaning                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `agent`              | The wallet the agent signs with. **Must equal the session owner** the gateway opens.     |
| `daily_cap_atomic`   | Rolling per-UTC-day ceiling, in USDsui atomic units (6 decimals — `5_000` = $0.005).      |
| `per_call_cap_atomic`| Hard limit on any single tool call. A pricier tool is rejected before it runs.            |
| `server_ids`         | Whitelist of server object ids. Empty = the agent may call any server.                    |
| `allowed_categories` | Whitelist of tool categories (`intelligence`, `data`, …). Empty = any category.           |
| `expires_at_ms`      | Wall-clock kill switch. `0` means it only ends when revoked.                              |

Pricing is **never** credit integers. It is an absolute amount in USDsui
smallest units:

```
1 USDsui = 1_000_000 atomic
$0.05    =    50_000 atomic
$0.005   =     5_000 atomic
```

Note the intent's `agent` must be the **same address** as the session the
agent's API key belongs to — the chain asserts `intent.agent ==
session.owner` (`E_INTENT_AGENT_MISMATCH`) and the gateway rejects a mismatch
up front with `intent_agent_mismatch`.

---

## 2. Run a local agent that uses the intent

The agent uses `@mcpxgg/sdk` exactly as normal — it just passes `intentId`
(and the tool's `category`) to `callTool`. Every call settles against the
intent's budget instead of the session's own caps.

```ts
import { createMCPXClient, MCPXError } from '@mcpxgg/sdk';

const INTENT_ID = process.env.MCPX_INTENT_ID!; // 0x… SpendingIntent object id

const client = createMCPXClient({
  apiKey: process.env.MCPX_API_KEY!, // key for the agent's session
  // A client-level default applied to every call (override per call if needed):
  intentId: INTENT_ID,
  category: 'intelligence',
});

// Drive several paid calls. Each one settles on-chain and emits IntentUsed.
const queries = ['latest sui validators', 'walrus blob retention', 'x402 spec'];

for (const q of queries) {
  try {
    const res = await client.callTool('walrus-search_query', { q });
    console.log(`✓ "${q}" → ${res.receipt.settlement}`);
    console.log(`  tx:     ${res.receipt.txDigest}`);
    console.log(`  spent:  ${res.receipt.amountAtomic} atomic USDsui`);
    console.log(`  blob:   ${res.receipt.blobId}`);
  } catch (e) {
    if (e instanceof MCPXError) {
      console.error(`✗ "${q}" rejected: ${e.code} — ${e.message}`);
      break; // budget exhausted or intent killed — stop the agent
    }
    throw e;
  }
}
```

You can also pass the intent per call instead of as a client default:

```ts
const client = createMCPXClient({ apiKey: process.env.MCPX_API_KEY! });

await client.callTool(
  'walrus-search_query',
  { q: 'sui' },
  { intentId: INTENT_ID, category: 'intelligence' },
);
```

Calling **without** `intentId` is fully supported and unchanged — the call
settles against the session's own balance and caps, no intent involved.

---

## 3. Observe `IntentUsed`

Every successful intent-scoped settlement emits an on-chain `IntentUsed`
event referencing the just-minted receipt and the amount:

```
IntentUsed { intent_id, receipt_id, amount_atomic }
```

The indexer mirrors these into the `intents` table and the live feed. You can
also watch them per-call from the SDK result: `res.receipt.txDigest` is the
settle transaction that carries the `IntentUsed` event, and
`res.receipt.amountAtomic` is exactly what was decremented from the intent's
daily counter.

---

## 4. The user revokes — the next call fails

At any time the budget owner can kill the intent:

```
mcpx::intent::revoke(intent, clock, ctx)   // emits IntentRevoked
```

(or click **Revoke** in the Intent Manager). The very next agent call fails
fast — the gateway reads the revoked flag from the mirror and refuses before
calling the server or the facilitator, so **no money moves**:

```ts
try {
  await client.callTool('walrus-search_query', { q: 'one more' });
} catch (e) {
  if (e instanceof MCPXError && e.code === 'intent_revoked') {
    console.error('Intent was revoked — agent is cut off. Halting.');
    process.exit(0);
  }
  throw e;
}
```

The agent receives a structured `MCPXError`. The `code` is machine-readable —
branch on it to make the agent self-halt cleanly.

### Rejection codes

Any of these mean **the call did not run and nothing settled**:

| `MCPXError.code`               | Cause                                                            |
| ------------------------------ | ---------------------------------------------------------------- |
| `intent_not_found`             | The supplied intent id is unknown.                               |
| `intent_revoked`               | Owner revoked the intent.                                        |
| `intent_expired`               | `expires_at_ms` is in the past.                                  |
| `intent_agent_mismatch`        | The session owner is not the intent's `agent`.                   |
| `intent_scope_mismatch`        | This server is not in `server_ids`.                              |
| `intent_category_not_allowed`  | The tool's category is not in `allowed_categories`.              |
| `intent_per_call_cap_exceeded` | This call's price exceeds `per_call_cap_atomic`.                  |
| `intent_daily_cap_exceeded`    | This call would push today's spend past `daily_cap_atomic`.      |

The gateway enforces these as a fast pre-flight; the chain re-enforces the
identical policy inside `settle_call_with_intent`, so a compromised gateway
can never overspend an intent.
