import Link from "next/link";
import { notFound } from "next/navigation";

import { CoachTopbar } from "@/components/coach-topbar";
import { SurveyBlockDetail, surveyDayLabel } from "@/components/survey-results";
import { requireCoach } from "@/lib/coach-auth";
import { getCoach } from "@/lib/coaches-repo";
import { canSeeSurveyResults } from "@/lib/practice-survey-results-core";
import { getSurveyBlock } from "@/lib/practice-survey-results-repo";
import { todayIso } from "@/lib/practices-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const metadata = { title: "Sondage d'une pratique — Espace Technique" };
export const dynamic = "force-dynamic";

/** Portail : les réponses des filles à la borne pour une pratique (JP, 25 nov. 2026) : qui a aidé ou encouragé le
 *  plus de filles en haut, puis le résumé et la réponse de chaque fille. Lecture seule, toute l'équipe. */
export default async function CoachSurveyBlockPage({ params }: { params: Promise<{ activityId: string }> }) {
  const coachId = await requireCoach();
  const { activityId } = await params;
  const db = getSupabaseAdminClient() as any;
  const [coach, { data: activity }, { data: mine }] = await Promise.all([
    getCoach(coachId),
    db.from("coach_activities").select("id, activity_date, activity_type, organization, location").eq("id", activityId).maybeSingle(),
    db.from("coach_assignments").select("id").eq("activity_id", activityId).eq("coach_id", coachId).limit(1)
  ]);
  if (!activity || !canSeeSurveyResults({ coachActive: Boolean(coach && coach.status !== "inactive"), assigned: Boolean(mine?.length), activity, today: todayIso() })) notFound();
  const { block, results } = await getSurveyBlock(activityId);

  return (
    <>
      <CoachTopbar coachName={coach ? `${coach.first_name} ${coach.last_name}` : "Entraîneur"} />
      <div className="admin-content">
        <div className="coach-page coach-page--wide mda" style={{ display: "grid", gap: 16 }}>
          <Link href="/entraineur/sondage" className="admin-btn-ghost" style={{ textDecoration: "none", justifySelf: "start" }}>← Sondage des jeunes</Link>
          <header>
            <p className="coach-eyebrow" style={{ textTransform: "none" }}>
              {surveyDayLabel(String(activity.activity_date).slice(0, 10))}
              {block ? ` · ${block.start.replace(":", " h ")}` : ""}
              {activity.location ? ` · ${activity.location}` : ""}
            </p>
            <h1 className="coach-title coach-title--xl" style={{ margin: 0 }}>{block ? block.label : "Sondage de la pratique"}</h1>
          </header>
          {block && results ? (
            <SurveyBlockDetail block={block} coachNames={results.coachNames} girlNames={results.girlNames} viewerId={coachId} />
          ) : (
            <div className="mda-card">
              <p style={{ margin: 0, color: "var(--adm-text-2)", fontSize: "0.875rem" }}>Pas encore de réponse de la borne pour cette pratique.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
