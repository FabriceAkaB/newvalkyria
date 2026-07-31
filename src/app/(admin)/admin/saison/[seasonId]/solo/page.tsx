import { notFound } from "next/navigation";

import { AdminSaisonSolo } from "@/components/admin-saison-solo";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getSeason,
  getSeasonSoloGroupDates,
  getSoloGroupMembers,
  getSoloGroups,
  getUnassignedSoloEligibleRegistrations
} from "@/lib/season-admin-repo";

export const metadata = { title: "Séances solo — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminSaisonSoloPage({ params }: { params: Promise<{ seasonId: string }> }) {
  await requireAdmin();
  const { seasonId } = await params;

  const season = await getSeason(seasonId);
  if (!season) notFound();

  const [groups, datesByGroup, membersByGroup, unassigned] = await Promise.all([
    getSoloGroups(seasonId),
    getSeasonSoloGroupDates(seasonId),
    getSoloGroupMembers(seasonId),
    getUnassignedSoloEligibleRegistrations(seasonId)
  ]);

  return (
    <AdminSaisonSolo
      season={season}
      initialGroups={groups}
      initialDatesByGroup={datesByGroup}
      initialMembersByGroup={membersByGroup}
      initialUnassigned={unassigned}
    />
  );
}
