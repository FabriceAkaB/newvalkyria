import { CLUB } from "@/lib/club";
import { addDays, buildGirlSchedule, MATCH_DAYS, type ScheduleEvent, type ScheduleItem, type ScheduleTeam } from "@/lib/family-schedule-core";
import { loadTeamTargets } from "@/lib/mcs-robot-runner";
import { personKey, teamsFor, yearsOf } from "@/lib/mcs-rules";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** L'horaire de chaque fille dans l'espace famille (Mandalart P8.8.04) : ses prochaines pratiques (14 jours) et ses
 *  prochains matchs, lus dans MonClubSportif (`mcs_events`). Une fille est reliée à ses équipes MCS par ses inscriptions
 *  payées, avec les mêmes règles que le robot (`loadTeamTargets` + `teamsFor`). Seules les inscriptions de la famille
 *  (mêmes noms, même profil ou même courriel parent que celles reçues) sont lues : aucune donnée d'une autre famille. */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface GirlSchedule {
  registrationId: string;
  firstName: string;
  practices: ScheduleItem[];
  matches: ScheduleItem[];
  /** La prochaine pratique (pour l'accueil). */
  next: ScheduleItem | null;
}

const low = (s: unknown) => String(s ?? "").trim().toLowerCase();

export async function getFamilySchedule(registrationIds: string[]): Promise<GirlSchedule[]> {
  const ids = [...new Set(registrationIds.filter(Boolean))];
  if (!ids.length) return [];
  const cols = "id, player_id, player_first_name, player_last_name, parent_email, season_id, program_id, time_slot_template_id, category_id, is_half_season, half_season_ends_on";
  const { data: base } = await db().from("registrations").select(cols).in("id", ids);
  const girls = ((base ?? []) as any[]).filter((r) => r.player_first_name).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  if (!girls.length) return [];

  const seasons = [...new Set(girls.map((g) => g.season_id).filter(Boolean))];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: CLUB.timezone });
  const nowHm = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: CLUB.timezone });
  const [teams, { data: seasonRegs }, { data: sessionRegs }, { data: cats }, { data: events }] = await Promise.all([
    loadTeamTargets(),
    seasons.length ? db().from("registrations").select(cols).in("season_id", seasons).eq("status", "paid").eq("is_trial", false) : Promise.resolve({ data: [] }),
    db().from("session_program_registrations").select("player_first_name, player_last_name, parent_email, program_slug").eq("status", "paid"),
    db().from("birth_categories").select("id, season_id, label"),
    db().from("mcs_events").select("team_id, event_date, start_time, end_time, title, location, type, opponent").gte("event_date", today).lte("event_date", addDays(today, MATCH_DAYS))
  ]);
  const catLabel = new Map(((cats ?? []) as any[]).map((c) => [`${c.season_id}|${c.id}`, c.label as string]));
  const teamNames = new Map(teams.map((t) => [t.id, t.name]));
  const evs: ScheduleEvent[] = ((events ?? []) as any[]).map((e) => ({
    teamId: e.team_id,
    date: String(e.event_date).slice(0, 10),
    start: e.start_time ? String(e.start_time).slice(0, 5) : null,
    end: e.end_time ? String(e.end_time).slice(0, 5) : null,
    title: String(e.title ?? ""),
    location: e.location ?? null,
    type: String(e.type ?? ""),
    opponent: e.opponent ?? null
  }));

  // Chaque fille : toutes ses inscriptions de la saison (deux plages = deux inscriptions) et ses programmes à dates
  // fixes, reconnus par son nom ET (son profil ou le courriel de son parent).
  const perGirl = girls.map((g) => {
    const key = personKey(g.player_first_name, g.player_last_name);
    const emails = new Set([low(g.parent_email)].filter(Boolean));
    const regs = ((seasonRegs ?? []) as any[]).filter(
      (r) => r.id === g.id || (r.season_id === g.season_id && personKey(r.player_first_name, r.player_last_name) === key && ((g.player_id && r.player_id === g.player_id) || emails.has(low(r.parent_email))))
    );
    if (!regs.some((r) => r.id === g.id)) regs.push(g);
    for (const r of regs) if (r.parent_email) emails.add(low(r.parent_email));
    const sessions = ((sessionRegs ?? []) as any[]).filter((r) => emails.has(low(r.parent_email)) && personKey(r.player_first_name, r.player_last_name) === key);
    const mine = new Map<string, ScheduleTeam>();
    const addTeam = (t: { id: string; name: string }, until: string | null) => {
      const prev = mine.get(t.id);
      if (!prev) mine.set(t.id, { id: t.id, name: t.name, until });
      else if (prev.until && (!until || until > prev.until)) prev.until = until;
    };
    for (const r of regs) {
      const years = yearsOf(catLabel.get(`${r.season_id}|${r.category_id}`) ?? r.category_id);
      const until = r.is_half_season && r.half_season_ends_on ? String(r.half_season_ends_on).slice(0, 10) : null;
      for (const t of teamsFor({ slotId: r.time_slot_template_id, programId: r.program_id, years }, teams)) addTeam(t, until);
    }
    for (const s of sessions) for (const t of teamsFor({ sessionProgramSlug: s.program_slug }, teams)) addTeam(t, null);
    return { g, regIds: regs.map((r) => r.id as string), teams: [...mine.values()] };
  });

  // Absences déjà notées dans le site (MonClubSportif → site, le jour même) : l'activité n'est pas montrée.
  const allRegIds = [...new Set(perGirl.flatMap((p) => p.regIds))];
  const { data: absent } = await db()
    .from("activity_player_attendance")
    .select("registration_id, activity:coach_activities!inner(activity_date, start_time)")
    .in("registration_id", allRegIds)
    .eq("status", "absent")
    .gte("activity.activity_date", today);

  return perGirl.map(({ g, regIds, teams: mine }) => {
    const absences = ((absent ?? []) as any[])
      .filter((a) => regIds.includes(a.registration_id) && a.activity)
      .map((a) => ({ date: String(a.activity.activity_date).slice(0, 10), start: a.activity.start_time ? String(a.activity.start_time).slice(0, 5) : null }));
    const s = buildGirlSchedule({ firstName: String(g.player_first_name).trim(), lastName: String(g.player_last_name ?? "").trim(), teams: mine, teamNames, events: evs, absences, today, nowHm });
    return { registrationId: g.id, firstName: String(g.player_first_name).trim(), practices: s.practices, matches: s.matches, next: s.practices[0] ?? null };
  });
}
