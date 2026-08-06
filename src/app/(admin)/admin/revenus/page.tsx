import { AdminRevenus } from "@/components/admin-revenus";
import { requireAdmin } from "@/lib/admin-auth";
import { computeRevenueSummary } from "@/lib/revenue-calc";

export const metadata = { title: "Revenus — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminRevenusPage() {
  await requireAdmin();
  const summary = await computeRevenueSummary();
  return <AdminRevenus summary={summary} />;
}
