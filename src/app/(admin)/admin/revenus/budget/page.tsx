import { AdminBudget } from "@/components/admin-budget";
import { requireAdmin } from "@/lib/admin-auth";
import { getBudgetVsActual } from "@/lib/revenue-calc";

export const metadata = { title: "Budget annuel — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminBudgetPage() {
  await requireAdmin({ roles: ["admin"] });
  const rows = await getBudgetVsActual();
  return <AdminBudget initialRows={rows} />;
}
