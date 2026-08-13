import { AdminAudit } from "@/components/admin-audit";
import { requireAdmin } from "@/lib/admin-auth";
import { getAuditLog } from "@/lib/audit-repo";

export const metadata = { title: "Journal d'audit — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  await requireAdmin({ roles: ["admin"] });
  const entries = await getAuditLog();
  return <AdminAudit initialEntries={entries} />;
}
