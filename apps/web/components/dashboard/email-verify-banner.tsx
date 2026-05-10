"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "./user-context";

export function EmailVerifyBanner() {
  const user = useUser();
  const supabase = createClient();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (user.email_verified || dismissed) return null;

  const handleResend = async () => {
    setSending(true);
    await supabase.auth.resend({
      type: "signup",
      email: user.email,
    });
    setSent(true);
    setSending(false);
  };

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-[var(--warning)] border-opacity-30 bg-[var(--warning)] bg-opacity-5 px-4 py-3">
      <p className="text-sm text-[var(--warning)]">
        {sent
          ? "Verification email sent! Check your inbox."
          : "Please verify your email address."}
      </p>
      <div className="flex items-center gap-2">
        {!sent && (
          <button
            onClick={handleResend}
            disabled={sending}
            className="text-sm font-medium text-[var(--warning)] hover:underline disabled:opacity-50"
          >
            {sending ? "Sending..." : "Resend"}
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
