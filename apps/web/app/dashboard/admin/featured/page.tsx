import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { listMarketplaceServers } from "@/lib/chain/reads";
import { FeaturedAdminClient } from "./featured-admin-client";

export const metadata = {
  title: "Featured Rotation | MCPX Admin",
};

export const dynamic = "force-dynamic";

export default async function FeaturedAdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  let servers: Array<{ objectId: string; name: string; namespace: string }> =
    [];
  try {
    servers = (await listMarketplaceServers()).map((s) => ({
      objectId: s.objectId,
      name: s.name,
      namespace: s.namespace,
    }));
  } catch {
    servers = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Featured Rotation
        </h1>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--text-secondary)" }}
        >
          Curate the weekly featured set shown on the marketplace home. This
          is editorial — an app-owned table, not on-chain state.
        </p>
      </div>
      <FeaturedAdminClient servers={servers} />
    </div>
  );
}
