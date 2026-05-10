import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UserProvider } from "@/components/dashboard/user-context";
import { Sidebar } from "@/components/dashboard/sidebar";
import type { Database } from "@/lib/supabase/types";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  const user = data as UserRow | null;

  if (!user) {
    redirect("/login");
  }

  return (
    <UserProvider user={user}>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 md:ml-64">
          <div className="mx-auto max-w-4xl p-6 pt-16 md:pt-6">
            {children}
          </div>
        </main>
      </div>
    </UserProvider>
  );
}
