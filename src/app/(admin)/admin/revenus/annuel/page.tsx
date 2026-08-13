import { AdminRevenusAnnuel } from "@/components/admin-revenus-annuel";
import { requireAdmin } from "@/lib/admin-auth";
import { BOUTIQUE_KEY, BOUTIQUE_LABEL, ETE_SEASON_KEY, ETE_SEASON_LABEL, getAnnualBreakdown, getExpensesForYear } from "@/lib/revenue-calc";
import { getSeasons } from "@/lib/season-admin-repo";

export const metadata = { title: "Vue annuelle — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminRevenusAnnuelPage({ searchParams }: { searchParams: Promise<{ annee?: string; saison?: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const { annee, saison } = await searchParams;
  const year = annee ? parseInt(annee, 10) : new Date().getFullYear();
  const seasonKey = saison || undefined;

  const seasons = await getSeasons();
  const seasonOptions = [
    { key: ETE_SEASON_KEY, label: ETE_SEASON_LABEL },
    ...seasons.filter((s) => s.id !== ETE_SEASON_KEY).map((s) => ({ key: s.id, label: s.label })),
    { key: BOUTIQUE_KEY, label: BOUTIQUE_LABEL }
  ];

  const [breakdown, expenses] = await Promise.all([getAnnualBreakdown(year, seasonKey), getExpensesForYear(year, seasonKey)]);

  return <AdminRevenusAnnuel breakdown={breakdown} expenses={expenses} seasonOptions={seasonOptions} currentSeason={seasonKey ?? ""} />;
}
