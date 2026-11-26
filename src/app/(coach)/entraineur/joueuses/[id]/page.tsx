import { notFound } from "next/navigation";

import { CoachTopbar } from "@/components/coach-topbar";
import { PlayerDossierView } from "@/components/player-dossier";
import { requireCoach } from "@/lib/coach-auth";
import { coachCanSeePlayer } from "@/lib/coach-portal-repo";
import { hasReportHour } from "@/lib/coach-report";
import { getCoach } from "@/lib/coaches-repo";
import { getExercises } from "@/lib/exercises-repo";
import { getPlayerDossier } from "@/lib/player-dossier-repo";

export const metadata = { title: "Dossier de la joueuse — Espace Technique" };
export const dynamic = "force-dynamic";

/** Le dossier complet d'une joueuse (JP, 26 nov. 2026) : toute l'équipe de l'Académie le lit ; les coachs qui
 *  remplissent les rapports (« Entraîneur principal ») y fixent aussi objectifs et routines. Aucun montant. */
export default async function CoachJoueurDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const coachId = await requireCoach();
  const { id } = await params;
  if (!(await coachCanSeePlayer(coachId, id))) notFound();

  const [coach, dossier, exercises] = await Promise.all([getCoach(coachId), getPlayerDossier(id), getExercises().catch(() => [])]);
  if (!dossier) notFound();

  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <div className="admin-section coach-page coach-page--wide">
          <PlayerDossierView
            d={dossier}
            canEdit={hasReportHour(coach?.role)}
            isVideographer={Boolean(coach?.is_videographer)}
            exercises={exercises.map((e) => ({ id: e.id, title: e.title }))}
          />
        </div>
      </div>
    </>
  );
}
