import type { Metadata } from "next";

import { KioskPracticePlan, KioskTabs } from "@/components/kiosk-practice";
import { CAUSERIE_TEXT, causerieDue } from "@/lib/coach-guide";
import { PracticeTournament } from "@/components/practice-tournament";
import { SurveyKiosk } from "@/components/survey-kiosk";
import { getKioskPlan } from "@/lib/kiosk-practice-repo";
import { getSurveyData } from "@/lib/practice-survey-repo";
import { getTournamentContext } from "@/lib/practice-tournament-repo";
import { signedPhotoUrl } from "@/lib/player-photos";
import { checkKioskKey } from "@/lib/survey-kiosk";
import { getThemeQuiz } from "@/lib/theme-quiz-repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Comment était ta pratique ? | New Valkyria", robots: { index: false, follow: false, nocache: true } };

/** La borne de sondage : l'iPad reste ouvert sur cette page à la fin de la pratique ; chaque fille touche sa photo
 *  et répond elle-même à 4 questions : plaisir, fatigue, l'aide de sa coach et l'aide des autres, puis, quand la
 *  pratique a un thème, « Qu'est-ce qu'on a travaillé aujourd'hui ? » (3 choix, JP 25 nov. 2026). */
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
  // Finie : plaisir, fatigue et l'aide de la coach donnés (ou l'ancienne borne, avant le 20 nov. 2026).
  const done = data.attendance.filter((a: any) => a.practice_rating != null && a.fatigue != null && (a.coach_helped != null || a.learning != null)).map((a) => a.registration_id);
  // Les 3 choix sont calculés ici une fois et gardés dans la page : les mêmes pour toutes, même hors réseau.
  const [plan, themeQuiz, tournament] = await Promise.all([getKioskPlan(activityId).catch(() => null), getThemeQuiz(activityId).catch(() => null), getTournamentContext(activityId).catch(() => null)]);
  const themeResults = Object.fromEntries(data.attendance.filter((a: any) => a.theme_correct === true || a.theme_correct === false).map((a: any) => [a.registration_id, a.theme_correct as boolean]));
  const survey = (
    <SurveyKiosk
      activityId={activityId}
      cle={cle!}
      title={data.label}
      players={data.roster.map((p) => ({ id: p.registrationId, first: nice(p.firstName), initial: p.lastName.trim().charAt(0).toUpperCase(), photo: photos.get(p.registrationId) ?? null }))}
      coaches={data.coaches}
      done={done}
      absent={data.attendance.filter((a) => a.status === "absent").map((a) => a.registration_id)}
      themeQuiz={themeQuiz}
      themeResults={themeResults}
    />
  );
  if (!plan && !tournament) return survey;
  // La pratique, le sondage et le tournoi (JP, 26 nov. 2026) dans la même page : une fois ouverte, tout marche sans réseau.
  const when = `${new Date(`${String(data.activity.activity_date).slice(0, 10)}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })} · ${String(data.activity.start_time).slice(0, 5)}${data.activity.location ? ` · ${data.activity.location}` : ""}`;
  const planView = plan ? (
    <KioskPracticePlan plan={plan} title={data.label} when={when} causerie={causerieDue(String(data.activity.activity_date)) ? CAUSERIE_TEXT : null} />
  ) : (
    <div style={{ background: "#fff", borderRadius: 16, padding: "1.1rem 1.2rem", border: "1px solid #e6e0ee" }}>
      <p style={{ margin: 0, fontWeight: 700 }}>Le plan de cette pratique n&apos;est pas encore prêt.</p>
    </div>
  );
  return (
    <KioskTabs
      initial={vue === "pratique" ? "pratique" : vue === "tournoi" && tournament ? "tournoi" : "sondage"}
      plan={planView}
      survey={survey}
      tournament={tournament ? <PracticeTournament endpoint={`/api/borne/${activityId}/tournoi`} query={`?cle=${encodeURIComponent(cle!)}`} initial={tournament} /> : undefined}
    />
  );
}
