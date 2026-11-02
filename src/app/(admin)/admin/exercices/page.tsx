import { AdminExercices } from "@/components/admin-exercices";
import { requireAdmin } from "@/lib/admin-auth";
import { getBank } from "@/lib/exercises-repo";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { getThemeForDate } from "@/lib/season-themes-repo";

export const metadata = { title: "Exercices — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Banque d'exercices Valkyria : recherche par âge, thème, type, lieu, nombre de joueuses, statut et note. */
export default async function AdminExercicesPage() {
  await requireAdmin({ roles: ["admin"] });
  const [{ entries }, theme] = await Promise.all([getBank(), getThemeForDate(SEASON_DB_ID, new Date()).catch(() => null)]);
  return <AdminExercices entries={entries} weekTheme={theme?.theme ?? null} />;
}
