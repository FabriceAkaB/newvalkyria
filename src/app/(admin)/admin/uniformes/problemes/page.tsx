import { AdminUniformesProblemes } from "@/components/admin-uniformes-problemes";
import { requireAdmin } from "@/lib/admin-auth";
import { getSeasons } from "@/lib/season-admin-repo";
import { getOpenProblems } from "@/lib/shop-repo";

export const metadata = { title: "Problèmes à régler — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminUniformesProblemesPage() {
  await requireAdmin();
  const [problems, seasons] = await Promise.all([getOpenProblems(), getSeasons()]);
  const seasonLabelByKey = Object.fromEntries(seasons.map((s) => [s.id, s.label] as const));
  return <AdminUniformesProblemes problems={problems} seasonLabelByKey={seasonLabelByKey} />;
}
