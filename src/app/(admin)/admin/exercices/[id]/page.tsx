import { notFound } from "next/navigation";

import { AdminExerciceFiche } from "@/components/admin-exercice-fiche";
import { requireAdmin } from "@/lib/admin-auth";
import { getBankEntry } from "@/lib/exercises-repo";

export const metadata = { title: "Fiche d'exercice — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Fiche Valkyria d'un exercice : contenu, liste de vérification, notes des éducateurs, statut et décision de JP.
 *  `/admin/exercices/nouveau` ouvre une fiche vide. */
export default async function AdminExerciceFichePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const { id } = await params;
  if (id === "nouveau") return <AdminExerciceFiche entry={null} ratings={[]} />;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const found = await getBankEntry(id);
  if (!found) notFound();
  return <AdminExerciceFiche entry={found.entry} ratings={found.ratings} />;
}
