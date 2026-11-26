import { notFound } from "next/navigation";

import { AdminExerciceFiche } from "@/components/admin-exercice-fiche";
import { requireAdmin } from "@/lib/admin-auth";
import { bibleKey } from "@/lib/exercise-bank";
import { getBankEntry, getExerciseUses } from "@/lib/exercises-repo";

export const metadata = { title: "Fiche d'exercice — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Fiche Valkyria d'un exercice : contenu, liste de vérification, notes des éducateurs, statut et décision de JP.
 *  `/admin/exercices/nouveau` ouvre une fiche vide. */
export default async function AdminExerciceFichePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ bible?: string }> }) {
  await requireAdmin({ roles: ["admin"] });
  const { id } = await params;
  // `?bible=psychomotricite` (bouton « Ajouter un exercice » d'une Bible) : la fiche vide est rangée dans cette Bible.
  if (id === "nouveau") return <AdminExerciceFiche entry={null} ratings={[]} defaultBible={bibleKey((await searchParams).bible)} />;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [found, uses] = await Promise.all([getBankEntry(id), getExerciseUses(id).catch(() => null)]);
  if (!found) notFound();
  return <AdminExerciceFiche entry={found.entry} ratings={found.ratings} uses={uses} />;
}
