import { AdminUniformesARemettre } from "@/components/admin-uniformes-a-remettre";
import { requireAdmin } from "@/lib/admin-auth";
import { getSeasons } from "@/lib/season-admin-repo";
import { getOrdersToDistribute, getUnassignedOrders, getUsedSeasonKeys } from "@/lib/shop-repo";

export const metadata = { title: "Uniformes à remettre — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminUniformesARemettrePage({ searchParams }: { searchParams: Promise<{ saison?: string }> }) {
  await requireAdmin();
  const { saison } = await searchParams;

  const [seasons, usedSeasonKeys, orders, unassigned] = await Promise.all([
    getSeasons(),
    getUsedSeasonKeys(),
    getOrdersToDistribute(saison),
    saison ? Promise.resolve([]) : getUnassignedOrders()
  ]);

  const seasonKeys = Array.from(new Set([...seasons.map((s) => s.id), ...usedSeasonKeys]));
  const seasonLabelByKey = Object.fromEntries(seasons.map((s) => [s.id, s.label] as const));

  return (
    <AdminUniformesARemettre
      orders={orders}
      unassignedOrders={unassigned}
      seasonKeys={seasonKeys}
      seasonLabelByKey={seasonLabelByKey}
      currentSeason={saison ?? ""}
    />
  );
}
