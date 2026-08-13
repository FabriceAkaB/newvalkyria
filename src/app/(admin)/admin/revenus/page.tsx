import { AdminRevenus } from "@/components/admin-revenus";
import { requireAdmin } from "@/lib/admin-auth";
import { computeFinancialDashboard, computeRevenueSummary, ETE_SEASON_KEY } from "@/lib/revenue-calc";
import { getSeasons } from "@/lib/season-admin-repo";

export const metadata = { title: "Revenus — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminRevenusPage() {
  await requireAdmin({ roles: ["admin"] });
  const [summary, dashboard, seasons] = await Promise.all([computeRevenueSummary(), computeFinancialDashboard(), getSeasons()]);
  const realSeasons = seasons.filter((s) => s.id !== ETE_SEASON_KEY);
  return <AdminRevenus summary={summary} dashboard={dashboard} seasons={realSeasons} />;
}
