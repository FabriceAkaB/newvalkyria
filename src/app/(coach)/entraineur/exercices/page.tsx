import { CoachTopbar } from "@/components/coach-topbar";
import { ExerciseBible } from "@/components/exercise-bible";
import { ModelPractices } from "@/components/model-practices";
import { requireCoach } from "@/lib/coach-auth";
import { getCoach } from "@/lib/coaches-repo";
import { bookExercises } from "@/lib/exercise-book-core";
import { getBank } from "@/lib/exercises-repo";
import { getModelPractices } from "@/lib/practice-history-repo";

export const metadata = { title: "La Bible New Valkyria — Espace Technique" };
export const dynamic = "force-dynamic";

/** Toute la banque d'exercices pour l'éducateur (JP, 25 nov. 2026) : la Bible (un livre, un chapitre par thème, une page
 *  par exercice), le descriptif en grille d'images et les meilleurs exercices. Lecture seule ; aucune date de
 *  planification ni note d'éducateur nommé (la planification annuelle reste fermée, coach-access-core.ts). */
export default async function CoachExercisesPage() {
  const coachId = await requireCoach();
  const [coach, { entries }, models] = await Promise.all([getCoach(coachId), getBank(), getModelPractices().catch(() => [])]);
  const exercises = bookExercises(entries);
  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <div className="coach-page coach-page--wide" style={{ maxWidth: 1280 }}>
          <h1 className="coach-title">La Bible New Valkyria</h1>
          <p className="coach-sub" style={{ marginBottom: 16 }}>Tous les exercices de l&apos;académie, classés par thème : feuillette le livre ou parcours le descriptif.</p>
          <ExerciseBible exercises={exercises} />
          <div className="mda" style={{ marginTop: 24 }}><ModelPractices practices={models} /></div>
        </div>
      </div>
    </>
  );
}
