import { AdminSeancesPrivees } from "@/components/admin-seances-privees";
import { requireAdmin } from "@/lib/admin-auth";
import { getCoaches } from "@/lib/coaches-repo";
import { getSlots, listBookings } from "@/lib/private-sessions-repo";
import { getTerrains } from "@/lib/terrains-repo";

export const metadata = { title: "Séances privées — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminSeancesPriveesPage() {
  await requireAdmin();

  const [slots, bookings, terrains, coaches] = await Promise.all([getSlots(), listBookings(), getTerrains(), getCoaches()]);

  return <AdminSeancesPrivees initialSlots={slots} initialBookings={bookings} terrains={terrains} coaches={coaches} />;
}
