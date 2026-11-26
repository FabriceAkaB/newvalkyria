import { CoachTopbar } from "@/components/coach-topbar";
import { ExerciseBible } from "@/components/exercise-bible";
import { ModelPractices } from "@/components/model-practices";
import { requireCoach } from "@/lib/coach-auth";
import { getGestures } from "@/lib/coaching-method-repo";
import { getCoach } from "@/lib/coaches-repo";
import { BIBLES, bibleInfo, bibleKey } from "@/lib/exercise-bank";
import { bibleExercises } from "@/lib/exercise-book-core";
import { getBank } from "@/lib/exercises-repo";
import { getModelPractices } from "@/lib/practice-history-repo";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ bible?: string }> }) {
  return { title: `${bibleInfo((await searchParams).bible).title} — Espace Technique` };
}
export const dynamic = "force-dynamic";

/** Toute la banque d'exercices pour l'éducateur (JP, 25 nov. 2026) : la Bible (un livre, un chapitre par thème, une page
 *  par exercice), le descriptif en grille d'images et les meilleurs exercices. Lecture seule ; aucune date de
 *  planification ni note d'éducateur nommé (la planification annuelle reste fermée, coach-access-core.ts). */
export default async function CoachExercisesPage({ searchParams }: { searchParams: Promise<{ bible?: string }> }) {
  const coachId = await requireCoach();
  const bible = bibleKey((await searchParams).bible);
  const [coach, { entries }, models, gestures] = await Promise.all([getCoach(coachId), getBank(), getModelPractices().catch(() => []), getGestures({ activeOnly: true }).catch(() => [])]);
  const exercises = bibleExercises(entries, bible, gestures);
  const counts = Object.fromEntries(BIBLES.map((b) => [b.key, bibleExercises(entries, b.key, gestures).length]));
  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <div className="coach-page coach-page--wide" style={{ maxWidth: 1280 }}>
          <h1 className="coach-title coach-title--xl">{bibleInfo(bible).title}</h1>
          <p className="coach-sub" style={{ marginBottom: 16 }}>{bibleInfo(bible).subtitle} Feuillette le livre ou parcours le descriptif.</p>
          <ExerciseBible key={bible} exercises={exercises} bible={bible} counts={counts} basePath="/entraineur/exercices" />
          <div className="mda" style={{ marginTop: 24 }}><ModelPractices practices={models} /></div>
        </div>
      </div>
    </>
  );
}
