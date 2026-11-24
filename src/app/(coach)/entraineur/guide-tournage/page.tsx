import { CoachTopbar } from "@/components/coach-topbar";
import { ShootingGuide } from "@/components/shooting-guide";
import { requireCoach } from "@/lib/coach-auth";
import { getCoach } from "@/lib/coaches-repo";
import { imageConsentCount } from "@/lib/content-repo";

export const metadata = { title: "Guide de tournage, Espace Technique" };
export const dynamic = "force-dynamic";

/** Le guide de tournage dans le portail (P3.2.24) : la personne caméra et Will (vidéaste) l'ont sur leur téléphone
 *  pendant la pratique. Le même contenu que /admin/contenu/guide. */
export default async function CoachShootingGuidePage() {
  const coachId = await requireCoach();
  const [coach, consent] = await Promise.all([getCoach(coachId), imageConsentCount().catch(() => null)]);
  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <div className="admin-section coach-page coach-page--wide mda" style={{ display: "grid", gap: 16 }}>
          <div>
            <p className="coach-eyebrow">Création de contenu</p>
            <h1 className="coach-title coach-title--xl">Guide de tournage</h1>
            <p className="coach-sub">Quoi filmer à chaque pratique, comment le filmer et comment on le monte. Les coachs coachent, la caméra filme.</p>
          </div>
          <ShootingGuide consent={consent} />
        </div>
      </div>
    </>
  );
}
