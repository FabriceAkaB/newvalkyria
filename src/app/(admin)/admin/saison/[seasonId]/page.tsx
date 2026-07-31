import { notFound } from "next/navigation";

import { AdminSaisonOverview } from "@/components/admin-saison-overview";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getSeason,
  getSeasonCategories,
  getSeasonPrograms,
  getSeasonRegistrations,
  getSeasonSlots
} from "@/lib/season-admin-repo";

export const metadata = { title: "Saison — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminSaisonPage({ params }: { params: Promise<{ seasonId: string }> }) {
  await requireAdmin();
  const { seasonId } = await params;

  const season = await getSeason(seasonId);
  if (!season) notFound();

  const [categories, programs, slots, registrations] = await Promise.all([
    getSeasonCategories(seasonId),
    getSeasonPrograms(seasonId),
    getSeasonSlots(seasonId),
    getSeasonRegistrations(seasonId)
  ]);

  return (
    <AdminSaisonOverview
      season={season}
      categories={categories}
      programs={programs}
      slots={slots}
      registrations={registrations}
    />
  );
}
