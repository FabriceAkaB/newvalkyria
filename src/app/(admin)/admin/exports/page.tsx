import { AdminExports } from "@/components/admin-exports";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata = { title: "Exports — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminExportsPage() {
  await requireAdmin();
  return <AdminExports />;
}
