import { AdminMatchs } from "@/components/admin-matchs";
import { requireAdmin } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { getAllBookings, getSlotsWithAvailability } from "@/lib/match-slots-repo";

export const metadata = { title: "Matchs vendus — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminMatchsPage() {
  await requireAdmin();
  const [slots, bookings] = await Promise.all([getSlotsWithAvailability({ includeInactive: true, includePast: true }), getAllBookings()]);
  return <AdminMatchs initial={{ slots, bookings }} origin={env.publicSiteUrl} />;
}
