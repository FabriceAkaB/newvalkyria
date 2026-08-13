import { AdminInscriptions } from "@/components/admin-inscriptions";
import { requireAdmin } from "@/lib/admin-auth";
import { getAllLeads } from "@/lib/repositories";
import { ETE_SEASON_KEY } from "@/lib/revenue-calc";
import { getSeasonCategories, getSeasonPrograms, getSeasons } from "@/lib/season-admin-repo";

export const metadata = { title: "Inscriptions — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminInscriptionsPage() {
  await requireAdmin();
  const [leads, seasons] = await Promise.all([getAllLeads(), getSeasons()]);

  const transferSeasons = await Promise.all(
    seasons
      .filter((s) => s.id !== ETE_SEASON_KEY)
      .map(async (s) => {
        const [categories, programs] = await Promise.all([getSeasonCategories(s.id), getSeasonPrograms(s.id)]);
        return {
          id: s.id,
          label: s.label,
          categories: categories.map((c) => ({ id: c.id, label: c.label })),
          programs: programs.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name }))
        };
      })
  );

  return <AdminInscriptions leads={leads} transferSeasons={transferSeasons} />;
}
