import { AdminEntraineursPaie } from "@/components/admin-entraineurs-paie";
import { requireAdmin } from "@/lib/admin-auth";
import { getPayrollRows } from "@/lib/coach-payroll-data";
import { getCoaches } from "@/lib/coaches-repo";

export const metadata = { title: "Paie — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminEntraineursPaiePage() {
  await requireAdmin({ roles: ["admin"] });
  const [rows, coaches] = await Promise.all([getPayrollRows(), getCoaches()]);
  return <AdminEntraineursPaie rows={rows} coaches={coaches} />;
}
