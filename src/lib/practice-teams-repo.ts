import { captainTaskFor, makeDuos, makeGroups, pickCaptains, teamName, themeForGroup, type PastTeam, type TeamKind } from "@/lib/practice-teams-core";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Équipes, duos et capitaines de chaque pratique (table `practice_teams`). Règles : practice-teams-core.ts. */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface PracticeTeam {
  id: string;
  activity_id: string;
  kind: TeamKind;
  label: string;
  position: number;
  members: string[];
  captain_registration_id: string | null;
  captain_task: string | null;
  leadership: number | null;
  leadership_note: string | null;
  rated_by: string | null;
  rated_at: string | null;
}

/** Les équipes et duos déjà formés pour cette pratique. */
export async function getTeamsForActivity(activityId: string): Promise<PracticeTeam[]> {
  const { data, error } = await db().from("practice_teams").select("*").eq("activity_id", activityId).order("kind").order("position");
  if (error) throw new Error(error.message);
  return (data ?? []) as PracticeTeam[];
}

/** L'historique des joueuses (6 derniers mois, autres pratiques) : avec qui elles ont été et qui a été capitaine. */
export async function getTeamHistory(registrationIds: string[], exceptActivityId?: string): Promise<PastTeam[]> {
  if (!registrationIds.length) return [];
  const since = new Date(Date.now() - 183 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await db()
    .from("practice_teams")
    .select("kind, members, captain_registration_id, activity_id, activity:coach_activities(activity_date)")
    .overlaps("members", registrationIds);
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[])
    .filter((t) => t.activity_id !== exceptActivityId && String(t.activity?.activity_date ?? "").slice(0, 10) >= since)
    .map((t) => ({ kind: t.kind, members: t.members ?? [], captain: t.captain_registration_id, date: String(t.activity?.activity_date ?? "").slice(0, 10) }));
}

/** Propose des équipes (ou des duos) nouvelles pour les joueuses présentes, avec capitaines et tâche du thème. */
export async function proposeTeams(input: { activityId: string; players: string[]; kind: TeamKind; count: number; theme: string | null; group: string | null; seed?: number }) {
  const history = await getTeamHistory(input.players, input.activityId);
  const groups = input.kind === "duo" ? makeDuos(input.players, history, input.seed) : makeGroups(input.players, input.count, history, input.seed);
  const captains = input.kind === "equipe" ? pickCaptains(groups, history) : groups.map(() => null);
  const task = input.kind === "equipe" ? captainTaskFor(themeForGroup(input.theme, input.group)) : null;
  return groups.map((members, i) => ({ label: teamName(i, input.kind), position: i, members, captain: captains[i], captainTask: task }));
}

/** Enregistre les équipes (ou les duos) de la pratique : remplace celles du même genre déjà enregistrées. */
export async function saveTeams(activityId: string, kind: TeamKind, teams: { label: string; members: string[]; captain: string | null; captainTask: string | null }[], by: string): Promise<PracticeTeam[]> {
  const del = await db().from("practice_teams").delete().eq("activity_id", activityId).eq("kind", kind);
  if (del.error) throw new Error(del.error.message);
  if (teams.length) {
    const { error } = await db()
      .from("practice_teams")
      .insert(
        teams.map((t, i) => ({
          activity_id: activityId,
          kind,
          label: t.label.slice(0, 40),
          position: i,
          members: t.members,
          captain_registration_id: t.captain && t.members.includes(t.captain) ? t.captain : null,
          captain_task: t.captainTask?.slice(0, 500) ?? null,
          created_by: by
        }))
      );
    if (error) throw new Error(error.message);
  }
  return getTeamsForActivity(activityId);
}

/** Note de leadership de la capitaine (1 à 5) et un mot de l'éducateur. */
export async function rateCaptain(teamId: string, activityId: string, leadership: number | null, note: string | null, by: string): Promise<void> {
  const { error } = await db()
    .from("practice_teams")
    .update({ leadership, leadership_note: note?.slice(0, 500) || null, rated_by: by, rated_at: new Date().toISOString() })
    .eq("id", teamId)
    .eq("activity_id", activityId);
  if (error) throw new Error(error.message);
}

/** Suivi du leadership pour l'admin : chaque capitaine, combien de fois, sa moyenne et ses derniers mots. */
export async function getCaptainFollowUp(): Promise<{ registrationId: string; name: string; group: string | null; times: number; average: number | null; last: { date: string; leadership: number | null; note: string | null; task: string | null }[] }[]> {
  const { data, error } = await db()
    .from("practice_teams")
    .select("captain_registration_id, captain_task, leadership, leadership_note, activity:coach_activities(activity_date, title)")
    .not("captain_registration_id", "is", null);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as any[];
  const ids = [...new Set(rows.map((r) => r.captain_registration_id))];
  const { data: regs } = ids.length ? await db().from("registrations").select("id, player_first_name, player_last_name").in("id", ids) : { data: [] };
  const name = new Map(((regs ?? []) as any[]).map((r) => [r.id, `${String(r.player_first_name ?? "").trim()} ${String(r.player_last_name ?? "").trim()}`.trim()]));
  return ids
    .map((id) => {
      const mine = rows
        .filter((r) => r.captain_registration_id === id)
        .map((r) => ({ date: String(r.activity?.activity_date ?? "").slice(0, 10), group: r.activity?.title ?? null, leadership: r.leadership, note: r.leadership_note, task: r.captain_task }))
        .sort((a, b) => b.date.localeCompare(a.date));
      const rated = mine.filter((m) => m.leadership != null);
      return {
        registrationId: id,
        name: name.get(id) ?? "Joueuse",
        group: mine[0]?.group ?? null,
        times: mine.length,
        average: rated.length ? Math.round((rated.reduce((s, m) => s + m.leadership, 0) / rated.length) * 10) / 10 : null,
        last: mine.slice(0, 5).map(({ date, leadership, note, task }) => ({ date, leadership, note, task }))
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
