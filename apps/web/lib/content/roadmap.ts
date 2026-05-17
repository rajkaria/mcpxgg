/**
 * S8-T11 — public, read-only roadmap.
 *
 * This is a CURATED MIRROR of the post-hackathon plan in docs/SPRINTS.md
 * (Phase 3 — Tier B, Sprints 9–15; Phase 4 — Tier C, Sprints 16–20). It is a
 * hand-extracted typed snapshot on purpose: the raw markdown is NOT imported
 * at runtime (per the S8-T11 task), so internal task IDs / effort columns
 * stay out of the public site and we don't ship the whole sprint tracker.
 *
 * Keep this in sync with docs/SPRINTS.md when the roadmap changes.
 */

export type RoadmapPhase = "Tier B — Growth" | "Tier C — Defensibility";

export interface RoadmapItem {
  /** Sprint number from the plan, public-facing as "milestone". */
  sprint: number;
  /** Tier-coded item id from SPRINTS Appendix C (e.g. "B1"). */
  code: string;
  title: string;
  goal: string;
  /** A few headline deliverables, plain-English, no internal task ids. */
  highlights: string[];
}

export interface RoadmapSection {
  phase: RoadmapPhase;
  blurb: string;
  items: RoadmapItem[];
}

export const ROADMAP: readonly RoadmapSection[] = [
  {
    phase: "Tier B — Growth",
    blurb:
      "Post-hackathon work that widens who can use MCPX and how they get paid.",
    items: [
      {
        sprint: 9,
        code: "B1",
        title: "Multi-tenant org sessions",
        goal: "Team accounts, fully on-chain.",
        highlights: [
          "Org sessions with members, roles, and per-member spend caps",
          "Scoped API keys per member with monthly limits and IP allowlisting",
          "Per-member usage dashboards and a per-org audit log with CSV export",
        ],
      },
      {
        sprint: 10,
        code: "B2",
        title: "Recoverable wallet auth",
        goal: "Never lose your account.",
        highlights: [
          "Designate 2-of-3 trusted guardians on-chain",
          "Time-delayed social recovery of your API key and session",
          "Guardian invite + notification flow at /recover",
        ],
      },
      {
        sprint: 11,
        code: "B3",
        title: "On-chain bounty demand board",
        goal: "Public demand signals with escrow.",
        highlights: [
          "Anyone can fund a USDsui bounty for a server that doesn't exist yet",
          "Developers claim the escrow by shipping a matching server",
          "Public /bounties board with contribution and submission flows",
        ],
      },
      {
        sprint: 12,
        code: "B4",
        title: "Auto-compound developer vaults",
        goal: "Sui DeFi, working for developers.",
        highlights: [
          "Route accrued vault earnings into Cetus, Bluefin, or Scallop",
          "Configurable threshold, slippage, and target protocol",
          "Vault P&L view with APY history",
        ],
      },
      {
        sprint: 13,
        code: "B5",
        title: "Telegram & Discord MCP bots",
        goal: "Call any tool from chat.",
        highlights: [
          "/call <server> <tool> <args> from Telegram or Discord",
          "Auto-provisioned embedded wallet + faucet for first calls",
          "Receipt links (Suiscan + Walrus) right in the reply",
        ],
      },
      {
        sprint: 14,
        code: "B6",
        title: "Token-gated MCP servers",
        goal: "Token- and NFT-gated access.",
        highlights: [
          "Servers can require a token/NFT balance to call",
          "Gateway pre-flight eligibility check via Sui RPC",
          "\"Requires X\" badge and eligibility checker in the marketplace",
        ],
      },
      {
        sprint: 15,
        code: "B7",
        title: "Cross-chain payouts",
        goal: "Earn on Sui, paid anywhere.",
        highlights: [
          "Claim earnings to Base or Solana via Wormhole",
          "Slippage protection and per-claim gas budgets",
          "Cross-chain claim status tracking with failure refunds",
        ],
      },
    ],
  },
  {
    phase: "Tier C — Defensibility",
    blurb:
      "Long-game primitives that make MCPX hard to displace once it's the default.",
    items: [
      {
        sprint: 16,
        code: "C1",
        title: "On-chain reviews & receipts as trust",
        goal: "Reviews ship on-chain; receipts become a reputation primitive.",
        highlights: [
          "Reviews gated by real CallReceipts from that server (anti-spam)",
          "Public CallReceipt history endpoint per agent address",
          "Any Sui app can read \"X has Y receipts via mcpxgg\"",
        ],
      },
      {
        sprint: 17,
        code: "C2",
        title: "Marketplace forks",
        goal: "Open-source the marketplace for vertical communities.",
        highlights: [
          "Extractable marketplace template under Apache 2.0",
          "Curation config: filters, allow/deny lists, custom branding",
          "First fork example: a DeFi-only marketplace",
        ],
      },
      {
        sprint: 18,
        code: "C3",
        title: "Per-call privacy proofs",
        goal: "Privacy-preserving compute attestation.",
        highlights: [
          "Opt-in private mode: Seal-encrypted inputs per call",
          "On-chain inputs commitment on the receipt",
          "Off-chain ZK verifier with a verification link in the viewer",
        ],
      },
      {
        sprint: 19,
        code: "C4",
        title: "Open agent registry",
        goal: "Verifiable agent identity and tiered pricing.",
        highlights: [
          "Register an agent; tier auto-promotes Bronze → Silver → Gold",
          "Gold agents get a configurable take-rate discount",
          "Agent profile pages with lifetime stats",
        ],
      },
      {
        sprint: 20,
        code: "C5",
        title: "MCP compatibility matrix",
        goal: "Future-proof against MCP standard fragmentation.",
        highlights: [
          "Weekly capability probe of every active server",
          "Compatibility badges (Anthropic, OpenAI, Google)",
          "Setup wizard only shows servers compatible with your client",
        ],
      },
    ],
  },
] as const;
