import { AdminInscriptions } from "@/components/admin-inscriptions";
import { requireAdmin } from "@/lib/admin-auth";
import { getAllLeads } from "@/lib/repositories";

export const metadata = { title: "Inscriptions — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminInscriptionsPage() {
  await requireAdmin();
  const leads = await getAllLeads();
  return <AdminInscriptions leads={leads} />;
}
