import { CoachTopbar } from "@/components/coach-topbar";
import { IdeaForm, MyIdeas } from "@/components/idea-box";
import { requireCoach } from "@/lib/coach-auth";
import { getCoach } from "@/lib/coaches-repo";
import { listIdeasForCoach } from "@/lib/idea-box-repo";

export const metadata = { title: "Boîte à suggestions — Espace Technique" };
export const dynamic = "force-dynamic";

/** Boîte à suggestions des coachs (JP, 19 nov. 2026) : même boîte que les familles, réponse de JP dans cette page. */
export default async function CoachIdeasPage() {
  const coachId = await requireCoach();
  const coach = await getCoach(coachId);
  const ideas = coach?.email ? await listIdeasForCoach(coach.email).catch(() => []) : [];
  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <div className="admin-section coach-page">
          <p className="coach-eyebrow">Boîte à suggestions</p>
          <h1 className="coach-title coach-title--xl">Ton idée compte</h1>
          <p className="coach-sub">
            Nous voulons améliorer l&apos;expérience de nos coachs et de nos athlètes. Une idée pour les pratiques, l&apos;organisation, le portail, le matériel, ce qui t&apos;aiderait ou ce qui te dérange : écris-la ici. JP lit chaque suggestion et te répond dans cette page.
          </p>
          <div className="coach-card" style={{ marginTop: 16 }}>
            <IdeaForm askIdentity={false} />
          </div>
          <h2 className="coach-h2" style={{ marginTop: 24 }}>Mes suggestions</h2>
          <MyIdeas ideas={ideas} />
        </div>
      </div>
    </>
  );
}
