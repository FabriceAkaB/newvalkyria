import { AdminPlages } from "@/components/admin-plages";
import { requireAdmin } from "@/lib/admin-auth";
import { getAllLeads } from "@/lib/repositories";

export const metadata = { title: "Plages horaires — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminPlagesPage() {
  await requireAdmin();
  const leads = await getAllLeads();
  return <AdminPlages leads={leads} />;
}
