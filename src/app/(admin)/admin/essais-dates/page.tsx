import { AdminEssaisDates } from "@/components/admin-essais-dates";
import { requireAdmin } from "@/lib/admin-auth";
import { getAllTrialSlots } from "@/lib/season-admin-repo";

export const metadata = { title: "Dates d'essai — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminEssaisDatesPage() {
  await requireAdmin();
  const slots = await getAllTrialSlots();
  return <AdminEssaisDates initialSlots={slots} />;
}
