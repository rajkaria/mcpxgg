"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/dashboard/settings`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[var(--text)]">Reset your password</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
            <p className="text-[var(--text)]">Check your email</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              We sent a password reset link to {email}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-sm text-[var(--error)]">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>
              Send reset link
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-[var(--text-secondary)]">
          <Link href="/login" className="text-[var(--primary)] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
