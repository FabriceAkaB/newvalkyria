import { AdminUniformesAujourdhui } from "@/components/admin-uniformes-aujourdhui";
import { requireAdmin } from "@/lib/admin-auth";
import { getSeasons } from "@/lib/season-admin-repo";
import { getOrdersToDistribute, getUsedSeasonKeys } from "@/lib/shop-repo";

export const metadata = { title: "Distribution aujourd'hui — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminUniformesAujourdhuiPage({ searchParams }: { searchParams: Promise<{ saison?: string }> }) {
  await requireAdmin();
  const { saison } = await searchParams;

  const [seasons, usedSeasonKeys, orders] = await Promise.all([getSeasons(), getUsedSeasonKeys(), getOrdersToDistribute(saison)]);
  const ready = orders.filter((o) => o.distribution_status === "pret_a_remettre" || o.distribution_status === "partiellement_remis");

  const seasonKeys = Array.from(new Set([...seasons.map((s) => s.id), ...usedSeasonKeys]));
  const seasonLabelByKey = Object.fromEntries(seasons.map((s) => [s.id, s.label] as const));

  return <AdminUniformesAujourdhui orders={ready} seasonKeys={seasonKeys} seasonLabelByKey={seasonLabelByKey} currentSeason={saison ?? ""} />;
}
