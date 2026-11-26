import { notFound } from "next/navigation";

import { CoachTopbar } from "@/components/coach-topbar";
import { PlayerVideoFicheView } from "@/components/progress-video-requests";
import { requireCoach } from "@/lib/coach-auth";
import { getCoach } from "@/lib/coaches-repo";
import { getPlayerVideoFiche } from "@/lib/progress-videos-repo";

export const metadata = { title: "Vidéos de la joueuse — Espace Technique" };
export const dynamic = "force-dynamic";

/** Fiche vidéo d'une joueuse pour le vidéaste : toutes ses vidéos, peu importe la date. */
export default async function CoachPlayerVideosPage({ params }: { params: Promise<{ id: string }> }) {
  const coachId = await requireCoach();
  const coach = await getCoach(coachId);
  if (!coach?.is_videographer) notFound();
  const { id } = await params;
  const fiche = await getPlayerVideoFiche(id);
  if (!fiche) notFound();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  return (
    <>
      <CoachTopbar coachName={`${coach.first_name} ${coach.last_name}`} />
      <div className="admin-content">
        <div className="admin-section coach-page coach-page--wide">
          <p className="coach-eyebrow"><a href="/entraineur/videos-joueuses/demandes">Demandes du jour</a> · <a href="/entraineur/videos-joueuses">Toutes les joueuses</a></p>
          <div style={{ marginTop: 12 }}>
            <PlayerVideoFicheView endpoint="/api/coach/progression-video" fiche={fiche} today={today} />
          </div>
        </div>
      </div>
    </>
  );
}
