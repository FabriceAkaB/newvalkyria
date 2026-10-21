import { AdminMatchs } from "@/components/admin-matchs";
import { requireAdmin } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { getAllBookings, getAllSlotRequests, getAllTeamProfiles, getSlotsWithAvailability } from "@/lib/match-slots-repo";

export const metadata = { title: "Matchs vendus — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminMatchsPage() {
  await requireAdmin();
  const [slots, bookings, profiles, requests] = await Promise.all([getSlotsWithAvailability({ includeInactive: true, includePast: true }), getAllBookings(), getAllTeamProfiles(), getAllSlotRequests()]);
  return <AdminMatchs initial={{ slots, bookings, profiles, requests }} origin={env.publicSiteUrl} />;
}
