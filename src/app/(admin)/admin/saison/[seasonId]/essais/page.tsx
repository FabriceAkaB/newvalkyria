import { notFound } from "next/navigation";

import { AdminSaisonEssais } from "@/components/admin-saison-essais";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getSeason,
  getSeasonCategories,
  getSeasonPrograms,
  getSeasonRegistrations,
  getSeasonSlots
} from "@/lib/season-admin-repo";

export const metadata = { title: "Essais saison — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminSaisonEssaisPage({ params }: { params: Promise<{ seasonId: string }> }) {
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

  const trials = registrations.filter((r) => r.is_trial);

  return (
    <AdminSaisonEssais
      season={season}
      categories={categories}
      programs={programs}
      slots={slots}
      initialTrials={trials}
    />
  );
}
