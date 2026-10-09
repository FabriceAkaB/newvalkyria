import { AdminReferences } from "@/components/admin-references";
import { requireAdmin } from "@/lib/admin-auth";
import { getCodeRows, getCreditOverview, getFinancialSummary, getReferralAdminRows } from "@/lib/private-programs-admin";

export const metadata = { title: "Références et crédits — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminReferencesPage() {
  await requireAdmin();
  const [referrals, credits, codes, financials] = await Promise.all([getReferralAdminRows(), getCreditOverview(), getCodeRows(), getFinancialSummary()]);
  return <AdminReferences initial={{ referrals, credits, codes, financials }} />;
}
