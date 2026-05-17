import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getInsuranceOverview } from "@/lib/chain/reads";
import { InsuranceAdminClient } from "./insurance-admin-client";

export const metadata = {
  title: "Insurance Fund | MCPX Admin",
};

export const dynamic = "force-dynamic";

export default async function InsuranceAdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  let overview = {
    balanceAtomic: "0",
    lifetimeCollectedAtomic: "0",
    lifetimePaidAtomic: "0",
  };
  try {
    const o = await getInsuranceOverview();
    overview = {
      balanceAtomic: o.balanceAtomic.toString(),
      lifetimeCollectedAtomic: o.lifetimeCollectedAtomic.toString(),
      lifetimePaidAtomic: o.lifetimePaidAtomic.toString(),
    };
  } catch {
    // mirror unavailable — render zeros
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Insurance Fund</h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Top up the on-chain insurance pool from sponsor donations. The amount
          is debited from your admin embedded wallet and routed to the pool via
          a single on-chain top_up call.
        </p>
      </div>
      <InsuranceAdminClient overview={overview} />
    </div>
  );
}
