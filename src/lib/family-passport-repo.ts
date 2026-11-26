import { stripSkippedGestures } from "@/lib/ball-mastery-skip-repo";
import { CLUB_ID } from "@/lib/club";
import { getGestures } from "@/lib/coaching-method-repo";
import { getPlayerObjectives } from "@/lib/coach-portal-repo";
import { buildFamilyPassport, parcoursRef, type FamilyPassportData } from "@/lib/family-passport";
import { getResults, getTests } from "@/lib/skill-tests-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Espace famille, page Progression : le passeport et le parcours de chaque fille de la famille. Ne lit que les
 *  inscriptions passées en paramètre (celles de la famille connectée, getFamilyRegistrations) : Loi 25. */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface FamilyParcours {
  passport: FamilyPassportData;
  objectives: string[];
  /** Demande de rencontre fille-parent-coach encore ouverte (tâche de JP), avec sa date. */
  meeting: { requestedAt: string; status: "a_faire" | "en_cours" } | null;
}

export async function getFamilyParcours(registrationIds: string[]): Promise<Map<string, FamilyParcours>> {
  const out = new Map<string, FamilyParcours>();
  if (!registrationIds.length) return out;
  const [tests, results, methodGestures, { data: evals }, { data: tasks }, objectives] = await Promise.all([
    getTests({ activeOnly: true }).catch(() => []),
    getResults(registrationIds).catch(() => []),
    getGestures({ activeOnly: true }).catch(() => []),
    // Ball mastery pas fait ce jour-là : ses gestes ne comptent pas dans le passeport.
    db().from("player_evaluations").select("activity_id, registration_id, gesture_scores, gestures, activity:coach_activities(activity_date)").in("registration_id", registrationIds).then(async (r: any) => ({ ...r, data: r.data ? await stripSkippedGestures(r.data) : r.data })),
    db()
      .from("team_tasks")
      .select("ref, status, created_at")
      .eq("club_id", CLUB_ID)
      .in("ref", registrationIds.map(parcoursRef))
      .in("status", ["a_faire", "en_cours"]),
    Promise.all(registrationIds.map((id) => getPlayerObjectives(id).catch(() => [])))
  ]);
  registrationIds.forEach((id, i) => {
    const own = ((evals ?? []) as any[]).filter((e) => e.registration_id === id);
    const task = ((tasks ?? []) as any[]).find((t) => t.ref === parcoursRef(id));
    out.set(id, {
      passport: buildFamilyPassport({
        tests,
        results: results.filter((r) => r.registration_id === id),
        evaluations: own.map((e) => ({ date: String(e.activity?.activity_date ?? "").slice(0, 10), gesture_scores: e.gesture_scores ?? {}, gestures: e.gestures ?? [] })),
        methodGestures
      }),
      objectives: objectives[i].filter((o) => o.active).map((o) => o.objective),
      meeting: task ? { requestedAt: String(task.created_at).slice(0, 10), status: task.status } : null
    });
  });
  return out;
}

/** La demande de rencontre ouverte d'une fille, s'il y en a une (une seule à la fois). */
export async function hasOpenMeetingRequest(registrationId: string): Promise<boolean> {
  const { data } = await db().from("team_tasks").select("id").eq("club_id", CLUB_ID).eq("ref", parcoursRef(registrationId)).in("status", ["a_faire", "en_cours"]).limit(1).maybeSingle();
  return Boolean(data);
}
