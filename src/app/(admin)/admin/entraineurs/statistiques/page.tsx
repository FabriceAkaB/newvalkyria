import { AdminEntraineursStatistiques } from "@/components/admin-entraineurs-statistiques";
import { requireAdmin } from "@/lib/admin-auth";
import { startOfMonth, startOfWeek } from "@/lib/coach-payroll";
import { getPayrollRows } from "@/lib/coach-payroll-data";
import { getActivities } from "@/lib/coaches-repo";

export const metadata = { title: "Statistiques entraîneurs — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminEntraineursStatistiquesPage() {
  await requireAdmin({ roles: ["admin"] });

  const [rows, activities] = await Promise.all([getPayrollRows(), getActivities()]);

  const today = new Date();
  const weekStartISO = startOfWeek(today).toISOString().slice(0, 10);
  const monthStartISO = startOfMonth(today).toISOString().slice(0, 10);

  const payrollWeek = rows.filter((r) => r.activityDate >= weekStartISO).reduce((s, r) => s + r.payCents, 0);
  const payrollMonth = rows.filter((r) => r.activityDate >= monthStartISO).reduce((s, r) => s + r.payCents, 0);
  const payrollTotal = rows.reduce((s, r) => s + r.payCents, 0);

  const activityCountByType = new Map<string, number>();
  for (const a of activities) activityCountByType.set(a.activity_type, (activityCountByType.get(a.activity_type) ?? 0) + 1);

  const costByCategory = new Map<string, number>();
  for (const r of rows) {
    const key = r.activityCategory ?? "Sans catégorie";
    costByCategory.set(key, (costByCategory.get(key) ?? 0) + r.payCents);
  }

  const avgCostPerActivity = activities.length > 0 ? Math.round(payrollTotal / activities.length) : 0;

  return (
    <AdminEntraineursStatistiques
      payrollWeekCents={payrollWeek}
      payrollMonthCents={payrollMonth}
      payrollTotalCents={payrollTotal}
      totalActivities={activities.length}
      activityCountByType={Array.from(activityCountByType.entries()).sort((a, b) => b[1] - a[1])}
      costByCategory={Array.from(costByCategory.entries()).sort((a, b) => b[1] - a[1])}
      avgCostPerActivityCents={avgCostPerActivity}
    />
  );
}
