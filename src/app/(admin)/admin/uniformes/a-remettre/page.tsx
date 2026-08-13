import { AdminUniformesARemettre } from "@/components/admin-uniformes-a-remettre";
import { requireAdmin } from "@/lib/admin-auth";
import { getActiveSeasonId, getSeasons } from "@/lib/season-admin-repo";
import { getOrdersToDistribute, getUnassignedOrders, getUsedSeasonKeys, maskOrderAmountsForGerante } from "@/lib/shop-repo";

export const metadata = { title: "Uniformes à remettre — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminUniformesARemettrePage({ searchParams }: { searchParams: Promise<{ saison?: string }> }) {
  const role = await requireAdmin();
  const { saison } = await searchParams;
  // Pas de paramètre = saison par défaut ; "all" = choix explicite "Toutes les saisons".
  const seasonKey = saison === undefined ? (await getActiveSeasonId()) ?? undefined : saison === "all" ? undefined : saison;

  const [seasons, usedSeasonKeys, orders, unassigned] = await Promise.all([
    getSeasons(),
    getUsedSeasonKeys(),
    getOrdersToDistribute(seasonKey),
    seasonKey ? Promise.resolve([]) : getUnassignedOrders()
  ]);

  const seasonKeys = Array.from(new Set([...seasons.map((s) => s.id), ...usedSeasonKeys]));
  const seasonLabelByKey = Object.fromEntries(seasons.map((s) => [s.id, s.label] as const));

  return (
    <AdminUniformesARemettre
      orders={role === "gerante" ? maskOrderAmountsForGerante(orders) : orders}
      unassignedOrders={role === "gerante" ? maskOrderAmountsForGerante(unassigned) : unassigned}
      seasonKeys={seasonKeys}
      seasonLabelByKey={seasonLabelByKey}
      currentSeason={seasonKey ?? ""}
    />
  );
}
