import type { Metadata } from "next";

import { KioskPracticePlan, KioskTabs } from "@/components/kiosk-practice";
import { SurveyKiosk } from "@/components/survey-kiosk";
import { getKioskPlan } from "@/lib/kiosk-practice-repo";
import { getSurveyData } from "@/lib/practice-survey-repo";
import { signedPhotoUrl } from "@/lib/player-photos";
import { checkKioskKey } from "@/lib/survey-kiosk";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Comment était ta pratique ? | New Valkyria", robots: { index: false, follow: false, nocache: true } };

/** La borne de sondage : l'iPad reste ouvert sur cette page à la fin de la pratique ; chaque fille touche sa photo
 *  et répond elle-même à 5 questions sur 10. */
export default async function KioskPage({ params, searchParams }: { params: Promise<{ activityId: string }>; searchParams: Promise<{ cle?: string; vue?: string }> }) {
  const { activityId } = await params;
  const { cle, vue } = await searchParams;
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
  // La borne s'ouvre avec une clé, sans connexion : liens signés de 4 heures pour les photos (stockage privé, Loi 25).
  const photos = new Map(await Promise.all(data.roster.map(async (p) => [p.registrationId, await signedPhotoUrl(p.photoUrl, 4 * 3600).catch(() => null)] as const)));
  const done = data.attendance.filter((a) => a.practice_rating != null && a.fatigue != null && a.learning != null).map((a) => a.registration_id);
  const plan = await getKioskPlan(activityId).catch(() => null);
  const survey = (
    <SurveyKiosk
      activityId={activityId}
      cle={cle!}
      title={data.label}
      players={data.roster.map((p) => ({ id: p.registrationId, first: nice(p.firstName), initial: p.lastName.trim().charAt(0).toUpperCase(), photo: photos.get(p.registrationId) ?? null }))}
      done={done}
      absent={data.attendance.filter((a) => a.status === "absent").map((a) => a.registration_id)}
    />
  );
  if (!plan) return survey;
  // La pratique et le sondage dans la même page (JP, 18 nov. 2026) : une fois ouverte, tout marche sans réseau.
  const when = `${new Date(`${String(data.activity.activity_date).slice(0, 10)}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })} · ${String(data.activity.start_time).slice(0, 5)}${data.activity.location ? ` · ${data.activity.location}` : ""}`;
  return <KioskTabs initial={vue === "pratique" ? "pratique" : "sondage"} plan={<KioskPracticePlan plan={plan} title={data.label} when={when} />} survey={survey} />;
}
