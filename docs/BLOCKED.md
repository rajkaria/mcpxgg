# Blocked on Raj — credential / decision gated

> Everything here is **code-complete or N/A from the code side**. None of it can be
> unblocked by writing more code — it needs an account, a key, a DNS record, a
> multisig signer, or a production cutover decision. Ordered by what unblocks the most.

## 0. The critical path (unblocks ~everything downstream)

| # | Item | Sprint IDs | What you do | Unblocks |
|---|---|---|---|---|
| 1 | **Sui keystore + testnet SUI** | S0-T19, S1-T17 | Create a non-prod Sui keystore (`sui client new-address ed25519`), fund it: `bash scripts/fund-test-account.sh`. Then `bash contracts/scripts/deploy-testnet.sh`. Paste printed object IDs into `.env.example` + `apps/gateway/DEPLOY.md`. | S2-T22/23, S3-T15/T17 (testnet E2E + Cursor demo), every on-chain integration test |
| 2 | **GitHub repo** | S0-T02, S0-T03, S0-T04 | `gh repo create mcpxgg --private --source . --remote origin`. CI workflow + Dependabot + CODEOWNERS files are written and waiting; they go green the moment a repo exists. | CI gate, this branch's PR, all future PRs |
| 3 | **Privy app** | S0-T08, S0-T09 | Create a Privy app, enable Sui + Google/Apple/email, drop `NEXT_PUBLIC_PRIVY_APP_ID` + `PRIVY_APP_SECRET` into Vercel/`.env.local`. | S4-T22 (Privy browser E2E), real sign-in on mcpx.gg |

## 1. Hosting / infra (needed for "replace live mcpx.gg")

| # | Item | Sprint IDs | What you do |
|---|---|---|---|
| 4 | Vercel projects | S0-T05 | Create Vercel projects for `apps/web` + `apps/docs`, link this repo, set env (Privy, Supabase, Redis, chain object IDs). |
| 5 | Supabase prod | (cutover) | Create the prod Supabase project; apply `supabase/migrations/001..009` (009 added this sprint). It is a **mirror** — safe to rebuild from chain. |
| 6 | Upstash Redis | (cutover) | Create Redis; set `UPSTASH_REDIS_REST_URL/TOKEN` (gateway auth + indexer pub/sub). |
| 7 | Fly.io services | S0-T06, S2-T10, S2-T21, S3-T09 | `fly launch` for `apps/gateway`, `apps/facilitator`, `apps/indexer`; set fly-secrets (gas-station key mlocked, RPC URLs, chain IDs). |
| 8 | DNS | S0-T07, S2-T11, S3-T10 | At the `mcp.gg` registrar: `mcp.` → gateway Fly, `facilitator.` → facilitator Fly, `docs.` → Vercel, apex/`www` → web Vercel. |

## 1b. Pre-existing build blocker (not Sprint-6-introduced)

| # | Item | Sprint IDs | What you do |
|---|---|---|---|
| 8b | `packages/walrus` `.js` import specifiers | pre-existing | `packages/walrus/src/index.ts` re-exports with `./seal.js` / `./backend.js` / `./http.js` / `./in-memory.js` specifiers while `main`/`types` resolve to TS source with no build emit. Turbopack (`next build`) can't remap `.js`→`.ts`, so `apps/web/app/receipts/[id]/page.tsx` + `components/SealReceiptViewer.tsx` fail to bundle. Reproduces on a clean baseline with all Sprint-6 changes stashed — **not introduced by Sprint 6**. Fix: make walrus's relative imports extensionless (like `@mcpxgg/chain` / `@mcpxgg/shared`, which build fine) or add a real build emit + point `main` at `dist`. `pnpm --filter ./apps/web typecheck` is fully green including all Sprint-6 code; only the Turbopack bundle of the unrelated receipts route is blocked. |

## 2. Trust / signing gated

| # | Item | Sprint IDs | What you do |
|---|---|---|---|
| 9 | Admin multisig (AdminCap) | S4-T15, ADR-001 | Stand up the multisig that holds `AdminCap`. The subsidy *gatekeeper* + budget ledger are done & tested; only the admin-signed on-chain disbursement waits on real signers. |
| 10 | npm org + token | S5-T12 | Create npm org, `npm login`, `npm publish --access public` from `cli/`. CLI is built & tested; publish is one command once the org exists. |

## 3. Mainnet deploy (the June 21 hard gate)

| # | Item | Sprint IDs | What you do |
|---|---|---|---|
| 11 | Mainnet Move deploy | S5-T21..T25, S6-T10, S6-T13 | After testnet rehearsal (item 1): mainnet keystore + multisig AdminCap, `bash contracts/scripts/deploy-mainnet.sh`, lock IDs in `DEPLOY.md` + prod env, re-publish anchor servers, run the post-deploy smoke. Audit checklist is in `contracts/MAINNET-PREP.md` (added this sprint). The S6 anchor servers `walrus-store` (S6-T10) and `sui-identity` (S6-T13) are code-complete with deploy-ready `Dockerfile` + `fly.toml`; deploy is one `fly deploy` each once the mainnet keystore exists. |

## "Replace the live mcpx.gg with this repo" — cutover plan

The currently-live site is the old Web2 build. This repo is the Sui rebuild. This is a
**production, destructive cutover** — I will not flip it without you wiring the accounts
above and giving an explicit go. Order of operations once items 2,4,5,6,7,8 are done:

1. Repo on GitHub (item 2) → connect Vercel (item 4) → preview deploy of `apps/web`.
2. Apply migrations to prod Supabase (item 5); point indexer at it (item 7).
3. Deploy gateway/facilitator/indexer to Fly (item 7); set DNS (item 8).
4. At minimum a **testnet** chain deploy (item 1) so the site has real object IDs;
   ideally **mainnet** (item 11) before the apex domain flips.
5. Run `scripts/migrate-web2-users.ts` (S8-T01, pre-written) so legacy credit
   balances become on-chain Session balances 1:1 (ADR-008).
6. Flip apex DNS / Vercel production alias from old build → new. Old build stays
   reachable at a `legacy.` subdomain for rollback for 1 week.

**Net:** the single highest-leverage thing you can do is **item 1 (Sui keystore +
testnet deploy)** and **item 2 (GitHub repo)**. Those two unblock CI, every E2E, the
Cursor demo, and the whole cutover sequence.
