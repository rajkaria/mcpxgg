import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UserProvider } from "@/components/dashboard/user-context";
import { Sidebar } from "@/components/dashboard/sidebar";
import { LowBalanceBanner } from "@/components/LowBalanceBanner";
import type { Database } from "@/lib/supabase/types";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

// S8-T18: authenticated surface — keep it out of the index.
export const metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // S4-T03: auth is Privy now, not Supabase Auth.
  const current = await getCurrentUser();
  if (!current) redirect("/?signin=1");

  const sb = createAdminClient();
  const { data } = await sb.from("users").select("*").eq("id", current.id).single();
  const user = data as UserRow | null;
  if (!user) redirect("/?signin=1");

  return (
    <UserProvider user={user}>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 md:ml-64">
          <div className="mx-auto max-w-4xl p-6 pt-16 md:pt-6">
            <LowBalanceBanner />
            {children}
          </div>
        </main>
      </div>
    </UserProvider>
  );
}
