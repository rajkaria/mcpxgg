"use client";

/**
 * Client providers (S4-T01). Wraps the app in Privy with Sui embedded
 * wallets + social/email login. Falls back to rendering children unwrapped
 * if NEXT_PUBLIC_PRIVY_APP_ID is unset (local dev without Privy).
 */

import { useEffect } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { PRIVY_APP_ID } from "@/lib/privy/config";
import { initPosthog } from "@/lib/analytics/posthog";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPosthog();
  }, []);
  if (!PRIVY_APP_ID) return <>{children}</>;
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["google", "email", "apple", "discord", "twitter", "wallet"],
        appearance: { theme: "dark", accentColor: "#6366f1" },
        embeddedWallets: { createOnLogin: "users-without-wallets" },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
