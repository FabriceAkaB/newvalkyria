import { CoachTopbar } from "@/components/coach-topbar";
import { ExerciseGallery } from "@/components/exercise-gallery";
import { ModelPractices } from "@/components/model-practices";
import { requireCoach } from "@/lib/coach-auth";
import { getCoach } from "@/lib/coaches-repo";
import { gallerySlides } from "@/lib/exercise-gallery";
import { getBank } from "@/lib/exercises-repo";
import { getModelPractices } from "@/lib/practice-history-repo";

export const metadata = { title: "Exercices Valkyria — Espace Technique" };
export const dynamic = "force-dynamic";

/** Les exercices approuvés en diapos, pour l'éducateur (lecture seule, aucune donnée de joueuse). */
export default async function CoachExercisesPage() {
  const coachId = await requireCoach();
  const [coach, { entries }, models] = await Promise.all([getCoach(coachId), getBank(), getModelPractices().catch(() => [])]);
  const slides = gallerySlides(entries);
  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <div className="coach-page">
          <h1 className="coach-title">Exercices Valkyria</h1>
          <p className="coach-sub" style={{ marginBottom: 16 }}>Les exercices approuvés, en diapos : balaie pour passer au suivant.</p>
          <div className="mda" style={{ marginBottom: 16 }}><ModelPractices practices={models} /></div>
          <ExerciseGallery slides={slides} />
        </div>
      </div>
    </>
  );
}
