# MCPX Demo Day script — 3 minutes

> **Artifact note.** This file is the *script*. The actual 1080p backup
> recording (S8-T06) is a **human task** — record it against mainnet (or
> the dress-rehearsal testnet capture) the day before Demo Day and store
> the file alongside the pitch deck. This document is what you rehearse
> and read from.

**Total: 3:00.** Timings are upper bounds — under is fine, over is not.
One presenter, screen shared, wallet pre-funded. Practice it five times;
the demo should run on muscle memory so you can talk over it.

---

## Pre-flight checklist (before you present — not on the clock)

- [ ] Browser open to `mcpx.gg`, logged out, on a clean profile.
- [ ] A second tab pre-opened to `mcpx.gg/marketplace`.
- [ ] Demo wallet funded with ~5 USDsui (so a recharge is instant).
- [ ] `mcpx.gg/live` open in a background tab (the Bloomberg terminal).
- [ ] Backup recording file open in a media player, paused at frame 0,
      window ready to alt-tab to.
- [ ] Network: phone hotspot ready as a fallback uplink.

---

## 0:00 – 0:25 — The hook (25s)

**Say:**

> "There are thousands of MCP servers and no native way to pay for them.
> MCPX makes a paid AI tool call a first-class on-chain primitive. Every
> call settles in a stablecoin on Sui, in one atomic transaction, with a
> permanent receipt. No tokens, no credit cards, no invoices. Let me show
> you a real call settle on mainnet."

**Click:** nothing yet — this is eye contact, not screen.

---

## 0:25 – 1:10 — User path: connect, recharge, call (45s)

**Click:**

1. `mcpx.gg` → **Connect** → social login (Google — fastest, no
   extension popup). *(Say: "Privy — no seed phrase, an embedded Sui
   wallet.")*
2. **Dashboard → Recharge → 1 USDsui → confirm.** *(Say: "That just
   called `session::deposit`. Balances are USDsui atomic, 6 decimals.")*
3. Switch to the **Marketplace** tab → open **`walrus-search`** → in the
   embedded widget, tool `query`, prefill `{"q":"sui"}` → **Call**.

**Say while it settles (~3–5s):**

> "One programmable transaction block: debit my session, pay the
> developer's vault, fund the treasury and the insurance pool, mint a
> soulbound receipt. All-or-nothing."

---

## 1:10 – 1:45 — The receipt + the differentiator (35s)

**Click:** the **receipt** block in the widget → open the `txDigest` in
the Sui explorer (pre-trusted link).

**Say:**

> "There's the on-chain receipt. It records the payer, the three fee
> shares, and a Walrus blob id pointing at the permanently-retained call
> log. This receipt is `key`-only — it can never be transferred or
> deleted. That's the differentiator: not a credit balance in someone's
> database — a verifiable, permanent, on-chain fact."

---

## 1:45 – 2:25 — Developer path + autonomous agent (40s)

**Click:** Dashboard → **Receipts / Vault** view (show accrued earnings),
then the **Intents** page.

**Say:**

> "Developers earn straight to a Sui vault — no payout schedule, no
> minimum, claim any time. And for autonomous agents: a SpendingIntent
> delegates a capped, revocable budget. The agent pays for its own calls
> within a per-call cap, a daily cap, allowed categories — and the
> *chain* re-enforces the policy, so a compromised gateway still can't
> overspend it. Five first-party servers ship on mainnet today; the whole
> stack is open."

---

## 2:25 – 3:00 — Close (35s)

**Click:** the **`mcpx.gg/live`** tab — the Bloomberg-style terminal
showing calls settling in real time.

**Say:**

> "This is live settlement on Sui mainnet. 2.5% take rate, on-chain and
> capped at 10%. 0.5% funds an insurance pool that refunds failed calls —
> proven by your receipt, not a support ticket. No token. Stablecoin
> revenue from the first call. MCPX: the on-chain marketplace for the MCP
> economy. Thank you."

---

## Fallback: if mainnet hiccups

**Trigger conditions:** the call spins > 8 seconds, the explorer link
errors, or the gateway returns a 5xx.

**Do not debug live.** Say one calm line and pivot:

> "Mainnet's having a moment — here's the exact same flow I recorded
> against mainnet earlier."

Then **alt-tab to the backup recording** (already paused at frame 0) and
narrate over it using the same beats above. The recording is timed to the
same 3:00 so you stay on schedule. When it finishes, return to the
**`/live`** tab if it has recovered; otherwise close on the recording's
final frame and deliver the 2:25–3:00 close verbatim.

**Network fallback:** if the venue uplink is the problem, switch to the
phone hotspot during the pre-flight, not mid-demo. If it fails mid-demo,
go straight to the recording — don't switch networks on stage.

---

## Rehearsal notes

- The two riskiest clicks are **Connect** (popup timing) and the **Call**
  (network latency). Rehearse those until they're automatic.
- Keep the explorer link a known-good bookmark; never type a URL on
  stage.
- Total spoken words ≈ 320 — that's ~2:10 of talking inside a 3:00 demo,
  leaving margin for clicks. Don't rush the close; it's the ask.
