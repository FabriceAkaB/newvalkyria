import { AdminJoueuses } from "@/components/admin-joueuses";
import { requireAdmin } from "@/lib/admin-auth";
import { getAllLeads } from "@/lib/repositories";

export const metadata = { title: "Joueuses — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminJoueusesPage() {
  await requireAdmin();
  const leads = await getAllLeads();
  return <AdminJoueuses leads={leads} />;
}
