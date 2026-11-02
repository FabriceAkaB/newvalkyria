import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-auth";
import { getActiveSeasonId } from "@/lib/season-admin-repo";

export const dynamic = "force-dynamic";

/** Pages de la saison en cours sans connaître son identifiant : /admin/saison?vue=essais
 *  mène à /admin/saison/<saison active>/essais (liens du menu, valables d'une saison à l'autre). */
const VUES = new Set(["inscriptions", "horaire", "capacite", "solo", "essais"]);

export default async function AdminCurrentSeasonPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  await requireAdmin();
  const { vue } = await searchParams;
  const seasonId = (await getActiveSeasonId()) ?? "automne-hiver-2026";
  redirect(`/admin/saison/${seasonId}${vue && VUES.has(vue) ? `/${vue}` : ""}`);
}
