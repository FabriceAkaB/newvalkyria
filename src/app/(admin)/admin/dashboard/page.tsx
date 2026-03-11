import { AdminDashboard } from "@/components/admin-dashboard";
import { requireAdmin } from "@/lib/admin-auth";
import { computeCapacityData } from "@/lib/capacity";
import { getAllLeads } from "@/lib/repositories";

export const metadata = { title: "Dashboard — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await requireAdmin();

  const [leads, capacity] = await Promise.all([
    getAllLeads(),
    computeCapacityData()
  ]);

  return <AdminDashboard leads={leads} capacity={capacity} />;
}
