import { AdminThemes } from "@/components/admin-themes";
import { requireAdmin } from "@/lib/admin-auth";
import { ETE_SEASON_KEY } from "@/lib/revenue-calc";
import { getActiveSeasonId, getSeasons } from "@/lib/season-admin-repo";
import { getSeasonThemes } from "@/lib/season-themes-repo";

export const metadata = { title: "Thèmes saisonniers — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminThemesPage({ searchParams }: { searchParams: Promise<{ saison?: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const { saison } = await searchParams;

  const allSeasons = await getSeasons();
  const seasons = allSeasons.filter((s) => s.id !== ETE_SEASON_KEY);
  const seasonId = saison || (await getActiveSeasonId()) || seasons[0]?.id || "";

  const themes = seasonId ? await getSeasonThemes(seasonId) : [];

  return <AdminThemes seasons={seasons} currentSeason={seasonId} themes={themes} />;
}
