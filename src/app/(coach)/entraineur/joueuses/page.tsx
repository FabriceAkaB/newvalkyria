import { CoachJoueuses } from "@/components/coach-joueuses";
import { requireCoach } from "@/lib/coach-auth";
import { getCoach } from "@/lib/coaches-repo";
import { getDossierPlayers } from "@/lib/player-dossier-repo";

export const metadata = { title: "Joueuses — Espace Technique" };
export const dynamic = "force-dynamic";

/** Toutes les joueuses de l'Académie, pour toute l'équipe (JP, 26 nov. 2026) : chaque fille ouvre son dossier complet. */
export default async function CoachJoueusesPage() {
  const coachId = await requireCoach();
  const [coach, players] = await Promise.all([getCoach(coachId), getDossierPlayers(coachId)]);

  return <CoachJoueuses coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} players={players} />;
}
