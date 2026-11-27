import { AdminMatchs } from "@/components/admin-matchs";
import { requireAdmin } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { slotLinks } from "@/lib/match-links";
import { getAwayMatches } from "@/lib/match-opponents-repo";
import { getAllBookings, getAllSlotRequests, getAllTeamProfiles, getSlotsWithAvailability } from "@/lib/match-slots-repo";

export const metadata = { title: "Matchs vendus — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminMatchsPage() {
  await requireAdmin();
  const [slots, bookings, profiles, requests, away] = await Promise.all([getSlotsWithAvailability({ includeInactive: true, includePast: true }), getAllBookings(), getAllTeamProfiles(), getAllSlotRequests(), getAwayMatches().catch(() => [])]);
  return <AdminMatchs initial={{ slots, bookings, profiles, requests, away, links: slotLinks(slots, bookings) }} origin={env.publicSiteUrl} />;
}
