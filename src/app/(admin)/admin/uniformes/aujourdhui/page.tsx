import { AdminUniformesAujourdhui } from "@/components/admin-uniformes-aujourdhui";
import { requireAdmin } from "@/lib/admin-auth";
import { getActiveSeasonId, getSeasons } from "@/lib/season-admin-repo";
import { getOrdersToDistribute, getUsedSeasonKeys, maskOrderAmountsForGerante } from "@/lib/shop-repo";

export const metadata = { title: "Distribution aujourd'hui — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminUniformesAujourdhuiPage({ searchParams }: { searchParams: Promise<{ saison?: string }> }) {
  const role = await requireAdmin();
  const { saison } = await searchParams;
  const seasonKey = saison === undefined ? (await getActiveSeasonId()) ?? undefined : saison === "all" ? undefined : saison;

  const [seasons, usedSeasonKeys, orders] = await Promise.all([getSeasons(), getUsedSeasonKeys(), getOrdersToDistribute(seasonKey)]);
  const ready = orders.filter((o) => o.distribution_status === "pret_a_remettre" || o.distribution_status === "partiellement_remis");

  const seasonKeys = Array.from(new Set([...seasons.map((s) => s.id), ...usedSeasonKeys]));
  const seasonLabelByKey = Object.fromEntries(seasons.map((s) => [s.id, s.label] as const));

  return (
    <AdminUniformesAujourdhui
      orders={role === "gerante" ? maskOrderAmountsForGerante(ready) : ready}
      seasonKeys={seasonKeys}
      seasonLabelByKey={seasonLabelByKey}
      currentSeason={seasonKey ?? ""}
    />
  );
}
