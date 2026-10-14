import { loadSlots } from "@/app/api/admin/sponsors-2027/route";
import { AdminSponsors2027 } from "@/components/admin-sponsors-2027";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata = { title: "Sponsors 2027 — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminSponsors2027Page() {
  // Accessible à l'administrateur ET à la gérante (suivi des commandites).
  const role = await requireAdmin();
  const slots = await loadSlots();
  return <AdminSponsors2027 initialSlots={slots} role={role} />;
}
