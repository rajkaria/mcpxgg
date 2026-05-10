"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/dashboard/user-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function SettingsPage() {
  const user = useUser();
  const supabase = createClient();
  const router = useRouter();

  const [displayName, setDisplayName] = useState(user.display_name || "");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleSaveName = async () => {
    setSavingName(true);
    await supabase
      .from("users")
      .update({ display_name: displayName })
      .eq("id", user.id);
    setNameSaved(true);
    setSavingName(false);
    setTimeout(() => setNameSaved(false), 2000);
    router.refresh();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPasswordError(error.message);
      setSavingPassword(false);
      return;
    }

    setPasswordSaved(true);
    setNewPassword("");
    setConfirmPassword("");
    setSavingPassword(false);
    setTimeout(() => setPasswordSaved(false), 2000);
  };

  const handleResendVerification = async () => {
    setResending(true);
    await supabase.auth.resend({ type: "signup", email: user.email });
    setResent(true);
    setResending(false);
    setTimeout(() => setResent(false), 3000);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text)]">Account Settings</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">Manage your account details</p>

      <div className="mt-6 space-y-6">
        {/* Display Name */}
        <Card>
          <CardTitle>Display Name</CardTitle>
          <div className="mt-4 flex gap-3">
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="max-w-xs"
            />
            <Button onClick={handleSaveName} loading={savingName} size="md">
              {nameSaved ? "Saved!" : "Save"}
            </Button>
          </div>
        </Card>

        {/* Email */}
        <Card>
          <CardTitle>Email</CardTitle>
          <p className="mt-2 text-sm text-[var(--text)]">{user.email}</p>
          <div className="mt-3 flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                user.email_verified
                  ? "bg-[var(--success)] bg-opacity-10 text-[var(--success)]"
                  : "bg-[var(--warning)] bg-opacity-10 text-[var(--warning)]"
              }`}
            >
              {user.email_verified ? "Verified" : "Not verified"}
            </span>
            {!user.email_verified && (
              <button
                onClick={handleResendVerification}
                disabled={resending}
                className="text-sm text-[var(--primary)] hover:underline disabled:opacity-50"
              >
                {resent ? "Sent!" : resending ? "Sending..." : "Resend verification"}
              </button>
            )}
          </div>
        </Card>

        {/* Password */}
        <Card>
          <CardTitle>Change Password</CardTitle>
          <form onSubmit={handleChangePassword} className="mt-4 space-y-3 max-w-xs">
            <Input
              id="new-password"
              label="New password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
            />
            <Input
              id="confirm-password"
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
            {passwordError && <p className="text-sm text-[var(--error)]">{passwordError}</p>}
            <Button type="submit" loading={savingPassword}>
              {passwordSaved ? "Updated!" : "Update password"}
            </Button>
          </form>
        </Card>

        {/* Phone Verification */}
        <Card>
          <CardTitle>Phone Verification</CardTitle>
          <div className="mt-2 flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                user.phone_verified
                  ? "bg-[var(--success)] bg-opacity-10 text-[var(--success)]"
                  : "bg-[var(--warning)] bg-opacity-10 text-[var(--warning)]"
              }`}
            >
              {user.phone_verified ? "Verified" : "Not verified"}
            </span>
            {user.phone_verified && user.phone_number && (
              <span className="text-sm text-[var(--text-secondary)]">{user.phone_number}</span>
            )}
          </div>
          {!user.phone_verified && (
            <Link href="/dashboard/verify-phone">
              <Button variant="secondary" size="sm" className="mt-3">
                Verify phone number
              </Button>
            </Link>
          )}
        </Card>
      </div>
    </div>
  );
}
