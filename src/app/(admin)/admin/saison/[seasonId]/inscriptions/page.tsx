import { notFound } from "next/navigation";

import { AdminSaisonInscriptions } from "@/components/admin-saison-inscriptions";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getSeason,
  getSeasonCategories,
  getSeasonPrograms,
  getSeasonRegistrations,
  getSeasonSlots
} from "@/lib/season-admin-repo";

export const metadata = { title: "Inscriptions saison — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminSaisonInscriptionsPage({ params }: { params: Promise<{ seasonId: string }> }) {
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
    <AdminSaisonInscriptions
      season={season}
      categories={categories}
      programs={programs}
      slots={slots}
      initialRegistrations={registrations}
    />
  );
}
