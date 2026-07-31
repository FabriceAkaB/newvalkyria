import { notFound } from "next/navigation";

import { AdminSaisonCapacite } from "@/components/admin-saison-capacite";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getSeason,
  getSeasonCategories,
  getSeasonPrograms,
  getSeasonProgramCategories,
  getSeasonRegistrations
} from "@/lib/season-admin-repo";

export const metadata = { title: "Capacité saison — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminSaisonCapacitePage({ params }: { params: Promise<{ seasonId: string }> }) {
  await requireAdmin();
  const { seasonId } = await params;

  const season = await getSeason(seasonId);
  if (!season) notFound();

  const [categories, programs, programCategories, registrations] = await Promise.all([
    getSeasonCategories(seasonId),
    getSeasonPrograms(seasonId),
    getSeasonProgramCategories(seasonId),
    getSeasonRegistrations(seasonId)
  ]);

  return (
    <AdminSaisonCapacite
      season={season}
      categories={categories}
      programs={programs}
      programCategories={programCategories}
      registrations={registrations}
    />
  );
}
