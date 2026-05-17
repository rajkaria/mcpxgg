"use client";

/**
 * S8-T02. Web2 → Sui migration UX. A legacy user whose balance has been
 * moved on-chain (users.migration_status = 'migrated') sees a one-time
 * "Welcome back" modal on their first authenticated visit, then is guided
 * through connecting their Privy wallet.
 *
 * Gating:
 *  - Server signal: GET /api/migration/status reads migration_status
 *    (read-only; the migration script is a separate workstream). If the
 *    column or user is missing the route returns { migrated: false } and
 *    this renders nothing — graceful degradation.
 *  - Client signal: a localStorage ack key so it shows once, not every load.
 *
 * Privy guidance: if Privy is available we surface its connect() so the
 * user is walked straight into wallet connect; otherwise we deep-link to
 * the dashboard which already runs the bind flow.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { Button } from "@/components/ui/button";

const ACK_KEY = "mcpx.migration.welcomed.v1";

function PrivyConnectButton() {
  // usePrivy throws if there is no PrivyProvider (local dev without app id),
  // so this is isolated in its own component rendered only when present.
  const { ready, authenticated, login } = usePrivy();
  if (ready && authenticated) {
    return (
      <Link href="/dashboard">
        <Button variant="primary" size="md" className="btn-shine">
          Go to your dashboard
        </Button>
      </Link>
    );
  }
  return (
    <Button
      variant="primary"
      size="md"
      className="btn-shine"
      disabled={!ready}
      onClick={() => login()}
    >
      Connect your wallet
    </Button>
  );
}

function SafePrivyConnect() {
  try {
    return <PrivyConnectButton />;
  } catch {
    return (
      <Link href="/dashboard">
        <Button variant="primary" size="md" className="btn-shine">
          Connect your wallet
        </Button>
      </Link>
    );
  }
}

export function MigrationWelcome() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    if (typeof window !== "undefined" && localStorage.getItem(ACK_KEY)) {
      return;
    }
    (async () => {
      try {
        const r = await fetch("/api/migration/status", { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { migrated?: boolean };
        if (alive && d.migrated) setShow(true);
      } catch {
        /* never block the page on this */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(ACK_KEY, String(Date.now()));
    } catch {
      /* private mode — fine, it just shows again next load */
    }
    setShow(false);
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="migration-welcome-title"
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        onClick={dismiss}
        aria-hidden="true"
      />
      <div className="glass-strong relative w-full max-w-md rounded-3xl p-8 animate-fade-in">
        <div
          className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: "var(--primary-glow)", color: "var(--primary)" }}
        >
          <svg
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />
          </svg>
        </div>
        <h2
          id="migration-welcome-title"
          className="text-2xl font-bold tracking-tight"
        >
          Welcome back. Your balance has been moved on-chain.
        </h2>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          MCPX now settles every tool call on Sui in USDsui — no more credits,
          no subscriptions. Your previous balance has been migrated 1:1 into
          an on-chain session you fully control. Connect your wallet to pick
          up exactly where you left off.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <SafePrivyConnect />
          <Button variant="secondary" size="md" onClick={dismiss}>
            Maybe later
          </Button>
        </div>
        <p
          className="mt-4 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Questions about the move?{" "}
          <Link href="/about" className="underline">
            Read what changed
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
