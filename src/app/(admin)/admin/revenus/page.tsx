import { AdminRevenus } from "@/components/admin-revenus";
import { requireAdmin } from "@/lib/admin-auth";
import { computeFinancialDashboard, computeRevenueSummary } from "@/lib/revenue-calc";

export const metadata = { title: "Revenus — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminRevenusPage() {
  await requireAdmin({ roles: ["admin"] });
  const [summary, dashboard] = await Promise.all([computeRevenueSummary(), computeFinancialDashboard()]);
  return <AdminRevenus summary={summary} dashboard={dashboard} />;
}
