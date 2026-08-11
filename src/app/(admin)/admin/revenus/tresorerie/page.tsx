import { AdminTresorerie } from "@/components/admin-tresorerie";
import { requireAdmin } from "@/lib/admin-auth";
import { computeFinancialDashboard, getUpcomingMovements } from "@/lib/revenue-calc";

export const metadata = { title: "Trésorerie — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminTresoreriePage() {
  await requireAdmin({ roles: ["admin"] });
  const [dashboard, movements] = await Promise.all([computeFinancialDashboard(), getUpcomingMovements()]);
  return <AdminTresorerie dashboard={dashboard} movements={movements} />;
}
