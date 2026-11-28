import { coachNames, girlName, rankHelpers, rankHelpersOverPeriod, sameField, summarizeResults, topPeers, type BlockSummary, type HelperRank, type Person, type ResultRow } from "@/lib/practice-survey-results-core";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Résultats du sondage des filles (borne) pratique par pratique, pour l'admin (Coaching → Sondage de fin) et le
 *  portail des éducateurs (Sondage des jeunes), JP 25 nov. 2026. Pratiques de l'Académie seulement, aucun montant. */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface SurveyBlock {
  activityId: string;
  date: string;
  start: string;
  location: string | null;
  /** Les groupes sur le terrain (ex. « 2016-2017 avancé et 2014-2015 »). */
  label: string;
  theme: string | null;
  /** Éducateurs sur le terrain (assignés à la pratique ou à un groupe à la même heure, absents exclus). */
  coaches: Person[];
  rows: ResultRow[];
  ranking: HelperRank[];
  summary: BlockSummary;
}

export interface SurveyResults {
  from: string;
  to: string;
  blocks: SurveyBlock[];
  /** Classement des éducateurs sur toute la période. */
  ranking: HelperRank[];
  summary: BlockSummary;
  /** Les filles nommées le plus souvent à « Quelqu'un t'a aidée ? ». */
  peers: { id: string; name: string; count: number }[];
  /** Les groupes de la période (filtre). */
  groups: string[];
  /** Prénom + initiale de chaque fille (réponses et amies nommées) et prénom de chaque éducateur. */
  girlNames: Map<string, string>;
  coachNames: Map<string, string>;
}

const groupName = (g: string | null | undefined) => String(g ?? "").replace(/^Filles\s+/i, "").trim();

/** Toutes les pratiques sondées de l'Académie entre deux dates (incluses), la plus récente d'abord. */
export async function getSurveyResults(opts: { from: string; to: string; group?: string | null; activityId?: string }): Promise<SurveyResults> {
  const { data: acts } = await db()
    .from("coach_activities")
    .select("id, activity_date, start_time, title, category, location")
    .gte("activity_date", opts.from)
    .lte("activity_date", opts.to)
    .is("organization", null)
    .in("activity_type", ["Pratique", "Camp"]);
  const activities = ((acts ?? []) as any[]).map((a) => ({
    id: String(a.id),
    date: String(a.activity_date).slice(0, 10),
    start: String(a.start_time ?? "").slice(0, 5),
    location: (a.location as string | null) ?? null,
    label: groupName(a.title || a.category) || "Pratique"
  }));
  const ids = activities.map((a) => a.id);
  if (!ids.length) return empty(opts);

  const [{ data: att }, { data: assigns }] = await Promise.all([
    db()
      .from("activity_player_attendance")
      .select("activity_id, registration_id, practice_rating, fatigue, coach_helped, coach_helpers, peer_helped, peer_helpers, theme_answer, theme_expected, theme_correct, wants_more, registration:registrations(player_first_name, player_last_name)")
      .in("activity_id", ids)
      .not("feedback_at", "is", null),
    db().from("coach_assignments").select("activity_id, coach_id, status, coach:coaches(id, first_name, last_name)").in("activity_id", ids)
  ]);
  const raw = (att ?? []) as any[];
  const names = new Map<string, string>();
  for (const r of raw) names.set(r.registration_id, girlName(r.registration?.player_first_name, r.registration?.player_last_name));
  // Les amies nommées qui n'ont pas répondu elles-mêmes : leur nom aussi.
  const missing = [...new Set(raw.flatMap((r) => (r.peer_helpers ?? []) as string[]))].filter((id) => !names.has(id));
  if (missing.length) {
    const { data: regs } = await db().from("registrations").select("id, player_first_name, player_last_name").in("id", missing);
    for (const r of (regs ?? []) as any[]) names.set(r.id, girlName(r.player_first_name, r.player_last_name));
  }

  const coachRows = ((assigns ?? []) as any[]).filter((a) => a.coach);
  const coachName = coachNames([...new Map(coachRows.map((a) => [a.coach_id, { id: a.coach_id, first: a.coach.first_name, last: a.coach.last_name }] as const)).values()]);
  // Éducateurs nommés par une fille sans être assignés dans la période : leur prénom aussi.
  const named = [...new Set(raw.flatMap((r) => (r.coach_helpers ?? []) as string[]))].filter((id) => !coachName.has(id));
  if (named.length) {
    const { data: extra } = await db().from("coaches").select("id, first_name, last_name").in("id", named);
    const more = coachNames([...coachRows.map((a) => ({ id: a.coach_id, first: a.coach.first_name, last: a.coach.last_name })), ...((extra ?? []) as any[]).map((c) => ({ id: c.id, first: c.first_name, last: c.last_name }))]);
    for (const [id, n] of more) coachName.set(id, n);
  }
  const onFieldOf = (activityIds: string[]): Person[] => {
    const out = new Map<string, Person>();
    for (const a of coachRows) {
      if (!activityIds.includes(a.activity_id) || ["absent", "cancelled"].includes(a.status) || out.has(a.coach_id)) continue;
      out.set(a.coach_id, { id: a.coach_id, name: coachName.get(a.coach_id) ?? "Éducateur" });
    }
    return [...out.values()];
  };

  const byActivity = new Map<string, any[]>();
  for (const r of raw) byActivity.set(r.activity_id, [...(byActivity.get(r.activity_id) ?? []), r]);

  let blocks: SurveyBlock[] = activities
    .filter((a) => byActivity.has(a.id) && (!opts.activityId || a.id === opts.activityId))
    .map((a) => {
      // Les groupes à la même heure au même endroit sans réponses à eux : leurs filles ont répondu ici.
      const mates = activities.filter((q) => q.id !== a.id && sameField(a, q) && !byActivity.has(q.id));
      const labels = [...new Set([a.label, ...mates.map((m) => m.label)])];
      const rows: ResultRow[] = (byActivity.get(a.id) ?? [])
        .map((r) => ({
          registrationId: r.registration_id,
          name: names.get(r.registration_id) ?? "Joueuse",
          practiceRating: r.practice_rating ?? null,
          fatigue: r.fatigue ?? null,
          coachHelped: r.coach_helped ?? null,
          coachHelpers: (r.coach_helpers ?? []) as string[],
          peerHelped: r.peer_helped ?? null,
          peerHelpers: (r.peer_helpers ?? []) as string[],
          themeAnswer: r.theme_answer ?? null,
          themeCorrect: r.theme_correct ?? null,
          wantsMore: (r.wants_more ?? []) as string[]
        }))
        .sort((x, y) => x.name.localeCompare(y.name, "fr"));
      const coaches = onFieldOf([a.id, ...mates.map((m) => m.id)]);
      return {
        activityId: a.id,
        date: a.date,
        start: a.start,
        location: a.location,
        label: labels.join(" et "),
        theme: (byActivity.get(a.id) ?? []).map((r) => r.theme_expected).find(Boolean) ?? null,
        coaches,
        rows,
        ranking: rankHelpers(rows, coaches, coachName),
        summary: summarizeResults(rows)
      };
    })
    .sort((x, y) => y.date.localeCompare(x.date) || y.start.localeCompare(x.start));
  const groups = [...new Set(blocks.map((b) => b.label))].sort((x, y) => x.localeCompare(y, "fr"));
  if (opts.group) blocks = blocks.filter((b) => b.label === opts.group);
  const all = blocks.flatMap((b) => b.rows);
  return { from: opts.from, to: opts.to, blocks, ranking: rankHelpersOverPeriod(blocks), summary: summarizeResults(all), peers: topPeers(all, names), groups, girlNames: names, coachNames: coachName };
}

function empty(opts: { from: string; to: string }): SurveyResults {
  return { from: opts.from, to: opts.to, blocks: [], ranking: [], summary: summarizeResults([]), peers: [], groups: [], girlNames: new Map(), coachNames: new Map() };
}

/** Les résultats d'une seule pratique (bloc null si elle n'a aucune réponse ou n'est pas une pratique de l'Académie). */
export async function getSurveyBlock(activityId: string): Promise<{ block: SurveyBlock | null; results: SurveyResults | null }> {
  const { data: a } = await db().from("coach_activities").select("activity_date").eq("id", activityId).maybeSingle();
  if (!a) return { block: null, results: null };
  const day = String(a.activity_date).slice(0, 10);
  const results = await getSurveyResults({ from: day, to: day, activityId });
  return { block: results.blocks[0] ?? null, results };
}

/** Entraîneur du mois (JP, 27 nov. 2026) : un classement par mois depuis que la question existe (20 nov. 2026). */
export async function getCoachOfMonthHistory(today: string): Promise<import("@/lib/coach-of-month").CoachOfMonth[]> {
  const { coachOfMonthHistory } = await import("@/lib/coach-of-month");
  const { getAdminCoachId } = await import("@/lib/admin-my-practices");
  const [res, jp] = await Promise.all([getSurveyResults({ from: "2026-11-20", to: today }), getAdminCoachId().catch(() => null)]);
  // JP ne concourt pas : l'entraîneur du mois se choisit dans son équipe.
  return coachOfMonthHistory(res.blocks.map((b) => ({ date: b.date, ranking: b.ranking.filter((r) => r.coachId !== jp) })), today);
}
