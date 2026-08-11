import { AdminPaiementsEchelonnes } from "@/components/admin-paiements-echelonnes";
import { requireAdmin } from "@/lib/admin-auth";
import { getAllPaymentPlansOverview, getSeasonPrograms, getSeasons } from "@/lib/season-admin-repo";

export const metadata = { title: "Paiements échelonnés — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

export default async function AdminPaiementsEchelonnesPage() {
  await requireAdmin({ roles: ["admin"] });

  const [plans, seasons] = await Promise.all([getAllPaymentPlansOverview(), getSeasons()]);
  const programsBySeasons = await Promise.all(seasons.map((s) => getSeasonPrograms(s.id)));

  const seasonLabelById = new Map(seasons.map((s) => [s.id, s.label] as const));
  const programNameById = new Map(programsBySeasons.flat().map((p) => [p.id, p.name] as const));

  return <AdminPaiementsEchelonnes plans={plans} seasonLabelById={Object.fromEntries(seasonLabelById)} programNameById={Object.fromEntries(programNameById)} />;
}
