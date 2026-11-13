import type { Metadata } from "next";

import { SurveyKiosk } from "@/components/survey-kiosk";
import { getSurveyData } from "@/lib/practice-survey-repo";
import { checkKioskKey } from "@/lib/survey-kiosk";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Comment était ta pratique ? | New Valkyria", robots: { index: false, follow: false, nocache: true } };

/** La borne de sondage : l'iPad reste ouvert sur cette page à la fin de la pratique ; chaque fille touche sa photo
 *  et répond elle-même à 5 questions sur 10. */
export default async function KioskPage({ params, searchParams }: { params: Promise<{ activityId: string }>; searchParams: Promise<{ cle?: string }> }) {
  const { activityId } = await params;
  const { cle } = await searchParams;
  const data = checkKioskKey(activityId, cle) ? await getSurveyData(activityId) : null;
  if (!data) {
    return (
      <div style={{ background: "#fff", borderRadius: 16, padding: "1.4rem", border: "1px solid #e6e0ee" }}>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0 }}>Lien introuvable</h1>
        <p style={{ color: "#5d566b" }}>Ouvre la borne depuis l&apos;admin (Coaching › Sondage de fin).</p>
      </div>
    );
  }
  // « JANIE » → « Janie », « LINA-ROSE » → « Lina-Rose » : les noms s'affichent pareil pour toutes.
  const nice = (s: string) => s.trim().toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());
  const done = data.attendance.filter((a) => a.practice_rating != null && a.fatigue != null && a.learning != null).map((a) => a.registration_id);
  return (
    <SurveyKiosk
      activityId={activityId}
      cle={cle!}
      title={data.label}
      players={data.roster.map((p) => ({ id: p.registrationId, first: nice(p.firstName), initial: p.lastName.trim().charAt(0).toUpperCase(), photo: p.photoUrl }))}
      done={done}
    />
  );
}
