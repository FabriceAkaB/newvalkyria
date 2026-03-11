import { AdminCapacite } from "@/components/admin-capacite";
import { requireAdmin } from "@/lib/admin-auth";
import { computeCapacityData } from "@/lib/capacity";

export const metadata = { title: "Capacité — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminCapacitePage() {
  await requireAdmin();
  const capacity = await computeCapacityData();
  return <AdminCapacite capacity={capacity} />;
}
