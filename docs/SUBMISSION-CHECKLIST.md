# MCPX — Hackathon Submission Checklist (S8-T13)

Tracks the hackathon-handbook submission requirements (mirrors `docs/SPRINTS.md`
Appendix A) plus the standard Sui / x402 submission bar. Status reflects the
**actual current repo state** as of this document, cross-checked against
`docs/SPRINTS.md` and `docs/BLOCKED.md`.

**Legend:** ✅ Done · 🟡 Pending (work or human action remaining) · ⛔ Blocked (credential/decision-gated, see `docs/BLOCKED.md`)

**Target:** Mainnet by **2026-06-21**; Demo Day **2026-07-20/21**.

---

## A. Core handbook items (SPRINTS Appendix A)

| Item | Status | Evidence / blocker |
|---|---|---|
| Project name: **mcpxgg / mcpx.gg** | ✅ | Set across repo, `README.md`, package names `@mcpxgg/*` |
| Description (one-liner + long) | 🟡 | One-liner in `README.md`; long-form submission copy to finalize in S8 (S8-T03 audit + S8-T05 docs feed it) |
| Logo (1:1) | 🟡 | Asset task, not code — owner: design. Not in repo yet |
| Public GitHub: monorepo | ✅ | `https://github.com/rajkaria/mcpxgg` — repo exists and `origin` is set (BLOCKED.md item 2 resolved) |
| Demo video (≤5 min) | 🟡 | Script ready (`docs/DEMO-SCRIPT.md`, 3-min walkthrough). Actual 1080p recording is a human task (S8-T06), recordable only after a testnet/mainnet deploy |
| Website live: mcpx.gg | ⛔ | Code complete; needs Vercel project + DNS + Privy app (BLOCKED.md items 3, 4, 8) |
| Deployment: Mainnet | ⛔ | Move package code-complete, 85/85 tests green; needs mainnet keystore + multisig AdminCap (BLOCKED.md items 1, 9, 11) |
| Move Package ID | ⛔ | Produced by mainnet deploy; `Move.toml` `published-at = "0x0"` until then |
| x402 facilitator URL | ⛔ | `apps/facilitator` code complete (Apache-2.0); needs Fly.io + DNS `facilitator.mcpx.gg` (BLOCKED.md items 7, 8) |
| 5 anchor servers live | ⛔ | All 5 code-complete (incl. S6 `walrus-store`, `sui-identity`); S6-T10/T13 deploy blocked on mainnet keystore (BLOCKED.md item 11) — Docker/fly ready, one `fly deploy` each |

## B. Standard Sui / x402 hackathon bar

| Item | Status | Evidence / blocker |
|---|---|---|
| Repo public & buildable from clean clone | 🟡 | Public ✅. Build: `sui move test` 85/85 ✅; monorepo typecheck green; one known non-Sprint-6 web bundling blocker (`packages/walrus` `.js` specifiers, BLOCKED.md item 8b) — fix identified |
| README with quickstart | ✅ | `README.md` has structure + "Quick start" section |
| Architecture doc | ✅ | `docs/ARCHITECTURE.md` (single-PTB data flow, deploy targets, latency budget) |
| Design decisions documented | ✅ | `docs/DECISIONS.md` — ADR-001…014 |
| Smart contract tests | ✅ | 85 Move tests, 85 pass, **81.09%** coverage (`sui move test --coverage`); see `docs/AUDIT.md` §6 |
| Security / audit artifact | ✅ | `docs/AUDIT.md` — trust model, per-module review, STRIDE table, invariant proof, OtterSec package (S8-T03) |
| Audit firm engaged (OtterSec) | 🟡 | Submission package ready (`docs/AUDIT.md`); engagement/credits request is a human action (SPRINTS L576) |
| On-chain settlement working | ✅ (code) / ⛔ (live) | `settlement::settle_call` + intent/upto variants tested end-to-end; live requires deploy |
| x402 facilitator spec compliance | 🟡 | `apps/facilitator` + `packages/x402` implemented; S7 noted x402 `upto` spec ambiguity to coordinate with x402 Foundation |
| Wallet / auth integration | ⛔ | Privy integrated in code; needs a real Privy app (BLOCKED.md item 3) |
| Docs site (docs.mcpx.gg) | ⛔ | `apps/docs` content exists; deploy is S8-T05/T15 + Vercel/DNS (BLOCKED.md items 4, 8) |
| Live demo / test flow | ⛔ | E2E flows coded & tested; live cold-visitor flow (S8-T19) needs deployed stack |
| What's working vs known limitations | ✅ | This document §C–§D + `docs/AUDIT.md` §4 (assumptions/stubs) + `docs/BLOCKED.md` |
| Team | 🟡 | Maintainer: Raj (`rajkaria`); `Move.toml` authors = "mcpxgg contributors". Formal team list = submission-form field |
| License | 🟡 | Facilitator/SDKs Apache-2.0 (`cli/LICENSE`, `starter-template/LICENSE`, ADR-006). **No root `LICENSE` file** — rest of monorepo intentionally private pre-launch (ADR-006); add explicit root license note before submission |
| Roadmap | ✅ | `docs/SPRINTS.md` is the full forward roadmap; public mirror page is S8-T11 (pending) |

---

## C. What's working (verifiable now, no deploy needed)

- **Move package:** all 13 modules compile; **85/85 tests pass**; 81.09% coverage. Atomic single-PTB settlement, three-way split conservation, soulbound receipts, single-claim refunds, session/intent caps — all tested (`docs/AUDIT.md` §5–§6).
- **Services (code-complete, tested):** gateway, facilitator (Apache-2.0 OSS), indexer, 5 anchor servers, CLI, SDKs, web app. Per CLAUDE.md session context: `pnpm turbo run typecheck` exit 0, `pnpm turbo run test` 24/24.
- **Docs:** ARCHITECTURE, DECISIONS (14 ADRs), SPRINTS, FEATURES, REUSE-MAP, DEMO-SCRIPT, and now AUDIT.

## D. Known limitations (be honest in the submission)

1. **Not yet deployed.** No mainnet/testnet package ID; all "live" items are credential-gated, not code-gated (`docs/BLOCKED.md`). Highest-leverage unblock: Sui keystore + testnet deploy (item 1).
2. **`staking::slash` has no on-chain breach predicate** — any `OracleCap` holder can slash arbitrarily (documented S7 stub; flagged as finding **T-STK-1** in `docs/AUDIT.md`). Either gate it on a `QualityAttestation` or exclude `staking` from the mainnet deploy until Sprint 7.
3. **Bearer-capability custody = authority.** AdminCap/OracleCap/InsurancePayerCap need multisig custody before mainnet (BLOCKED.md item 9).
4. **Sprint stubs:** `bundle` price multiplier not wired into settlement; `vault` auto-claim threshold stored-but-unenforced; `access::ScopedKey` is informational. All documented in `docs/AUDIT.md` §2/§4.
5. **One web bundling blocker** (`packages/walrus` `.js` import specifiers, BLOCKED.md item 8b) — pre-existing, not Sprint-6, fix identified.
6. **Facilitator price honesty is a trust assumption** by design (`docs/AUDIT.md` §4 item 1) — on-chain backstop is user-set session/intent caps.

## E. Pre-submission action items (human, not code)

1. ⛔→✅ Run BLOCKED.md item 1 (Sui keystore + testnet deploy), then item 11 (mainnet) — unblocks ~all "live" rows above.
2. 🟡 Record the 1080p demo video against the deployed stack (`docs/DEMO-SCRIPT.md`, S8-T06).
3. 🟡 Engage OtterSec with `docs/AUDIT.md` (request hackathon audit credits, SPRINTS L576).
4. 🟡 Add explicit root-level license clarification (ADR-006: facilitator/SDK Apache-2.0, rest private pre-launch) so reviewers aren't confused by the missing root `LICENSE`.
5. 🟡 Finalize logo (1:1), long description, and formal team list on the submission form.
6. 🟡 Decide T-STK-1 disposition (predicate fix vs exclude `staking` from mainnet) before the mainnet deploy.
