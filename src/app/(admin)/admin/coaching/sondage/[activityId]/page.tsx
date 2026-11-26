import Link from "next/link";
import { notFound } from "next/navigation";
import { Tablet } from "lucide-react";

import { AdminTopbar } from "@/components/admin-topbar";
import { PracticeSurvey, type SurveyPresence } from "@/components/practice-survey";
import { SurveyBlockDetail } from "@/components/survey-results";
import { ThemeWhoCard } from "@/components/theme-quiz-results";
import { requireAdmin } from "@/lib/admin-auth";
import { getSurveyBlock } from "@/lib/practice-survey-results-repo";
import { answerOf, getSurveyData } from "@/lib/practice-survey-repo";
import { kioskPath } from "@/lib/survey-kiosk";
import { getThemeQuiz } from "@/lib/theme-quiz-repo";

export const metadata = { title: "Sondage de fin — Coaching", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Sondage de fin d'une pratique : les résultats (classement des éducateurs, résumé, chaque fille ; JP 25 nov. 2026)
 *  et la saisie au bord du terrain sur le téléphone (?vue=saisie). */
export default async function SurveyPage({ params, searchParams }: { params: Promise<{ activityId: string }>; searchParams: Promise<{ vue?: string }> }) {
  await requireAdmin({ roles: ["admin", "gerante", "borne"] });
  const { activityId } = await params;
  const [data, { block, results }] = await Promise.all([getSurveyData(activityId), getSurveyBlock(activityId).catch(() => ({ block: null, results: null }))]);
  if (!data) notFound();
  const view = (await searchParams).vue === "saisie" || !block ? "saisie" : "resultats";
  const { activity, roster, attendance, label } = data;
  const quiz = await getThemeQuiz(activityId).catch(() => null);
  const rowOf = new Map(attendance.map((a) => [a.registration_id, a as any] as const));
  const cap = (x: string) => x.trim().toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());
  // « Qu'est-ce qu'on a travaillé aujourd'hui ? » : les filles là aujourd'hui (absentes exclues).
  const themePlayers = roster
    .filter((p) => rowOf.get(p.registrationId)?.status !== "absent" || rowOf.get(p.registrationId)?.theme_correct != null)
    .map((p) => ({ id: p.registrationId, name: `${cap(p.firstName)} ${p.lastName.trim().charAt(0).toUpperCase()}.`, row: rowOf.get(p.registrationId) ?? null }));
  const themeLabel = quiz?.correct ?? attendance.map((a: any) => a.theme_expected).find(Boolean) ?? null;
  const date = new Date(`${String(activity.activity_date).slice(0, 10)}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section mda" style={{ maxWidth: view === "saisie" ? 720 : 1040 }}>
          <Link href="/admin/coaching/sondage" className="mda-sub" style={{ textDecoration: "none" }}>← Toutes les pratiques</Link>
          <header>
            <p className="mda-eyebrow" style={{ textTransform: "none" }}>
              <span style={{ textTransform: "capitalize" }}>{date}</span> · {String(activity.start_time).slice(0, 5)}
              {activity.location ? ` · ${activity.location}` : ""}
            </p>
            <h1 className="mda-h1">{label} · {roster.length} joueuse{roster.length > 1 ? "s" : ""}</h1>
          </header>
          <nav className="admin-tabs" style={{ margin: 0 }} aria-label="Vue">
            <Link href={`/admin/coaching/sondage/${activity.id}`} className="admin-tab" data-active={String(view === "resultats")} style={{ textDecoration: "none" }}>Résultats</Link>
            <Link href={`/admin/coaching/sondage/${activity.id}?vue=saisie`} className="admin-tab" data-active={String(view === "saisie")} style={{ textDecoration: "none" }}>Saisie au bord du terrain</Link>
          </nav>
          {view === "resultats" && block && results ? (
            <SurveyBlockDetail block={block} coachNames={results.coachNames} girlNames={results.girlNames}>
              {block.summary.theme.answered ? <ThemeWhoCard theme={themeLabel} players={themePlayers} /> : null}
            </SurveyBlockDetail>
          ) : (
            <>
              {!block ? <p className="mda-lead" style={{ margin: 0 }}>Pas encore de réponse pour cette pratique : les résultats (qui a aidé le plus de filles, le résumé, chaque fille) s&apos;affichent dès la première réponse.</p> : null}
              <p className="mda-lead" style={{ margin: 0 }}>Touche « Présente » ou « Absente », puis pour chaque fille : son plaisir et sa fatigue sur 10 et, si elle veut, ce qu&apos;elle aimerait avoir plus. Tout s&apos;enregistre à chaque touche.</p>
              <a href={kioskPath(activity.id)} target="_blank" rel="noreferrer" className="admin-btn-primary" style={{ textDecoration: "none", justifySelf: "start" }}>
                <Tablet size={16} strokeWidth={1.75} aria-hidden style={{ verticalAlign: "-3px", marginRight: 6 }} />Ouvrir la borne sur l&apos;iPad
              </a>
              <ThemeWhoCard theme={themeLabel} players={themePlayers} />
              <PracticeSurvey
                activityId={activity.id}
                players={roster}
                initialPresence={Object.fromEntries(attendance.map((a) => [a.registration_id, a.status as SurveyPresence]))}
                initialAnswers={Object.fromEntries(attendance.map((a) => [a.registration_id, answerOf(a)]))}
                feedbackUrl="/api/admin/coaching/sondage/reponse"
                attendanceUrl="/api/admin/coaching/sondage/presence"
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
