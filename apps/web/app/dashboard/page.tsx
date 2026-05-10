import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { EmailVerifyBanner } from "@/components/dashboard/email-verify-banner";
import type { Database } from "@/lib/supabase/types";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser!.id)
    .single();

  const user = data as UserRow | null;

  return (
    <div>
      <EmailVerifyBanner />

      <h1 className="text-2xl font-bold text-[var(--text)]">
        Welcome{user?.display_name ? `, ${user.display_name}` : ""}
      </h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Your MCPX dashboard
      </p>

      {/* Stat cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardTitle>Credits</CardTitle>
          <p className="mt-2 text-3xl font-bold text-[var(--text)]">
            {user?.credit_balance?.toLocaleString() ?? "—"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Available credits</p>
        </Card>
        <Card>
          <CardTitle>Connected MCPs</CardTitle>
          <p className="mt-2 text-3xl font-bold text-[var(--text)]">&mdash;</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">Active servers</p>
        </Card>
        <Card>
          <CardTitle>API Calls</CardTitle>
          <p className="mt-2 text-3xl font-bold text-[var(--text)]">&mdash;</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">This month</p>
        </Card>
      </div>

      {/* Getting started checklist */}
      <Card className="mt-6">
        <CardTitle>Getting Started</CardTitle>
        <div className="mt-4 space-y-3">
          <ChecklistItem done label="Create your account" />
          <ChecklistItem done={user?.email_verified ?? false} label="Verify your email" />
          <ChecklistItem done={user?.phone_verified ?? false} label="Verify your phone number" />
          <ChecklistItem done={false} disabled label="Connect your first MCP server" />
        </div>
      </Card>
    </div>
  );
}

function ChecklistItem({
  done,
  label,
  disabled,
}: {
  done: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${disabled ? "opacity-50" : ""}`}>
      <div
        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
          done
            ? "border-[var(--success)] bg-[var(--success)] bg-opacity-10"
            : "border-[var(--border)]"
        }`}
      >
        {done && (
          <svg className="h-3 w-3 text-[var(--success)]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </div>
      <span className={`text-sm ${done ? "text-[var(--text-muted)]" : "text-[var(--text)]"}`}>
        {label}
      </span>
    </div>
  );
}
