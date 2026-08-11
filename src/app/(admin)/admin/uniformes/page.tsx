import { AdminUniformesDashboard } from "@/components/admin-uniformes-dashboard";
import { requireAdmin } from "@/lib/admin-auth";
import { getSeasons } from "@/lib/season-admin-repo";
import { getUniformStats, getUnassignedOrders, getUsedSeasonKeys } from "@/lib/shop-repo";

export const metadata = { title: "Uniformes — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminUniformesPage() {
  await requireAdmin();

  const [seasons, usedSeasonKeys, unassigned] = await Promise.all([getSeasons(), getUsedSeasonKeys(), getUnassignedOrders()]);

  const seasonKeys = Array.from(new Set([...seasons.map((s) => s.id), ...usedSeasonKeys]));
  const seasonLabelByKey = new Map(seasons.map((s) => [s.id, s.label] as const));

  const stats = await Promise.all(
    seasonKeys.map(async (key) => ({ key, label: seasonLabelByKey.get(key) ?? key, stats: await getUniformStats(key) }))
  );

  return <AdminUniformesDashboard seasonStats={stats} unassignedCount={unassigned.length} />;
}
