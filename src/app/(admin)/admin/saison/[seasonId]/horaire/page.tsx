import { notFound } from "next/navigation";

import { AdminSaisonHoraire } from "@/components/admin-saison-horaire";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getSeason,
  getSeasonCategories,
  getSeasonPrograms,
  getSeasonSlotDates,
  getSeasonSlots
} from "@/lib/season-admin-repo";

export const metadata = { title: "Horaire saison — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminSaisonHorairePage({ params }: { params: Promise<{ seasonId: string }> }) {
  await requireAdmin();
  const { seasonId } = await params;

  const season = await getSeason(seasonId);
  if (!season) notFound();

  const [categories, programs, slots, datesBySlot] = await Promise.all([
    getSeasonCategories(seasonId),
    getSeasonPrograms(seasonId),
    getSeasonSlots(seasonId),
    getSeasonSlotDates(seasonId)
  ]);

  return (
    <AdminSaisonHoraire
      season={season}
      categories={categories}
      programs={programs}
      initialSlots={slots}
      initialDatesBySlot={datesBySlot}
    />
  );
}
