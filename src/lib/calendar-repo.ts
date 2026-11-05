import { randomBytes } from "crypto";

import { getActivities, getCoaches } from "@/lib/coaches-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

/* ── Jeton d'abonnement calendrier (iCal) ──────────────────────────
 *  Ni Rétroaction ni TeamLinkt n'exposent d'API publique documentée
 *  (vérifié le 13 août 2026 — voir l'audit) ; l'export iCal est le seul
 *  mécanisme de synchronisation calendrier qu'on peut construire et tester
 *  sans dépendre d'un service tiers non vérifiable. ── */

export async function getOrCreateCalendarFeedToken(): Promise<string> {
  const supabase = db();
  const { data, error } = await supabase.from("calendar_feed_token").select("token").eq("id", true).maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.token) return data.token as string;

  const token = randomBytes(24).toString("hex");
  const { error: insertErr } = await supabase.from("calendar_feed_token").upsert({ id: true, token, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (insertErr) throw new Error(insertErr.message);
  return token;
}

export async function regenerateCalendarFeedToken(): Promise<string> {
  const token = randomBytes(24).toString("hex");
  const { error } = await db().from("calendar_feed_token").upsert({ id: true, token, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return token;
}

export async function verifyCalendarFeedToken(token: string): Promise<boolean> {
  const { data, error } = await db().from("calendar_feed_token").select("token").eq("id", true).maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data?.token) && data.token === token;
}

export interface CalendarEvent {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  /** "seance_privee" et "sport_etudes" sont branchés respectivement en
   *  Phase 2 et Phase 4 (voir plan) — le type est étendu dès maintenant
   *  pour que les filtres/vues de l'admin puissent être construits sans
   *  changement de signature plus tard. */
  kind: "activite" | "essai" | "seance_privee" | "sport_etudes";
  activityType: string | null;
  title: string;
  location: string | null;
  terrainId: string | null;
  category: string | null;
  coachNames: string | null;
  /** Activité de JP hors académie (Saint-Gabriel, FC Elevate…), sinon null. */
  organization?: string | null;
}

/** Calendrier unifié — combine les activités entraîneurs (pratiques, matchs,
 *  tournois...) et les essais des deux systèmes d'inscription (leads Été +
 *  registrations Automne/Hiver+), sur une plage de dates donnée. Ne couvre
 *  pas encore les séances Solo (calendrier dédié déjà existant sous chaque saison),
 *  les séances privées (Phase 2) ni le programme Sport-Études (Phase 4). */
export async function getUnifiedCalendarEvents(from: string, to: string): Promise<CalendarEvent[]> {
  const [activities, regTrialsRes, leadTrialsRes, coaches, assignmentsRes, privateBookingsRes, sportEtudesSessionsRes] = await Promise.all([
    getActivities({ from, to }),
    db()
      .from("registrations")
      .select("id, trial_date, player_first_name, player_last_name, category_id")
      .eq("is_trial", true)
      .neq("status", "cancelled")
      .not("trial_date", "is", null)
      .gte("trial_date", from)
      .lte("trial_date", to),
    db()
      .from("leads")
      .select("id, trial_date, player_age, goal")
      .not("trial_date", "is", null)
      .gte("trial_date", from)
      .lte("trial_date", to),
    getCoaches(),
    db().from("coach_assignments").select("activity_id, coach_id"),
    db()
      .from("private_session_bookings")
      .select("id, parent_name, notes, slot:private_session_slots!inner(slot_date, admin_start_time, admin_end_time, location, terrain_id)")
      .eq("status", "reserved")
      .gte("slot.slot_date", from)
      .lte("slot.slot_date", to),
    db()
      .from("sport_etudes_sessions")
      .select("id, session_date, start_time, end_time, location, terrain_id, label")
      .eq("active", true)
      .gte("session_date", from)
      .lte("session_date", to)
  ]);

  const coachNameById = new Map(coaches.map((c) => [c.id, `${c.first_name} ${c.last_name}`.trim()]));
  const coachNamesByActivity = new Map<string, string>();
  for (const row of (assignmentsRes.data ?? []) as { activity_id: string; coach_id: string }[]) {
    const name = coachNameById.get(row.coach_id);
    if (!name) continue;
    const existing = coachNamesByActivity.get(row.activity_id);
    coachNamesByActivity.set(row.activity_id, existing ? `${existing}, ${name}` : name);
  }

  const activityEvents: CalendarEvent[] = activities.map((a) => ({
    id: a.id,
    date: a.activity_date,
    startTime: a.start_time,
    endTime: a.end_time,
    kind: "activite",
    activityType: a.activity_type,
    title: a.title || a.activity_type,
    location: a.location,
    terrainId: a.terrain_id,
    category: a.category,
    coachNames: coachNamesByActivity.get(a.id) ?? null,
    organization: (a as { organization?: string | null }).organization ?? null
  }));

  const regTrials = (regTrialsRes.data ?? []) as any[];
  const regTrialEvents: CalendarEvent[] = regTrials.map((r) => ({
    id: r.id,
    date: r.trial_date,
    startTime: null,
    endTime: null,
    kind: "essai",
    activityType: null,
    title: `Essai — ${r.player_first_name ?? ""} ${r.player_last_name ?? ""}`.trim() || `Essai (${r.category_id ?? ""})`,
    location: null,
    terrainId: null,
    category: r.category_id ?? null,
    coachNames: null
  }));

  const leadTrials = (leadTrialsRes.data ?? []) as any[];
  const leadTrialEvents: CalendarEvent[] = leadTrials.map((l) => {
    const nameMatch = (l.goal || "").match(/Joueuse:\s*([^·]+)/);
    const name = nameMatch?.[1]?.trim();
    return {
      id: l.id,
      date: l.trial_date,
      startTime: null,
      endTime: null,
      kind: "essai",
      activityType: null,
      title: name ? `Essai — ${name}` : `Essai (${l.player_age ?? "Été 2026"})`,
      location: null,
      terrainId: null,
      category: l.player_age ?? null,
      coachNames: null
    };
  });

  const privateBookings = (privateBookingsRes.data ?? []) as any[];
  const privateSessionEvents: CalendarEvent[] = privateBookings
    .filter((b) => b.slot)
    .map((b) => ({
      id: b.id,
      date: b.slot.slot_date,
      startTime: b.slot.admin_start_time,
      endTime: b.slot.admin_end_time,
      kind: "seance_privee",
      activityType: "Séance privée",
      title: `Séance privée — ${b.parent_name}`,
      location: b.slot.location,
      terrainId: b.slot.terrain_id,
      category: null,
      coachNames: null
    }));

  const sportEtudesSessions = (sportEtudesSessionsRes.data ?? []) as any[];
  const sportEtudesEvents: CalendarEvent[] = sportEtudesSessions.map((s) => ({
    id: s.id,
    date: s.session_date,
    startTime: s.start_time,
    endTime: s.end_time,
    kind: "sport_etudes",
    activityType: "Sport-Études",
    title: `Sport-Études — ${s.label}`,
    location: s.location,
    terrainId: s.terrain_id,
    category: null,
    coachNames: null
  }));

  return [...activityEvents, ...regTrialEvents, ...leadTrialEvents, ...privateSessionEvents, ...sportEtudesEvents].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.startTime ?? "").localeCompare(b.startTime ?? "");
  });
}

/* ── Agenda personnel de JP (« ?perso=1 ») ───────────────────────────
 *  Tout ce qui est dans MonClubSportif (JP est assigné à toutes les activités de toutes les équipes),
 *  plus ce que le site connaît en dehors (activités hors académie, pratiques plus loin que la fenêtre iCal de MCS).
 *  Une activité du site à la même date et la même heure qu'une activité MCS n'est pas répétée. */

export interface McsFeedRow {
  key: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  location: string | null;
  team: string;
}

/** Titre MCS lisible : sans le préfixe « Event Équipe - » / « Game Équipe - », avec l'équipe devant. */
export function mcsFeedTitle(title: string | null, team: string): string {
  const raw = (title ?? "").trim();
  const ev = raw.match(/^(?:event|[ée]v[ée]nement)\s+.+\s+-\s+(.+)$/i);
  const game = raw.match(/^\S+\s+.+?\s+vs\.?\s+(.+)$/i);
  const clean = (ev ? ev[1] : game ? `Match c. ${game[1]}` : raw).trim() || "Activité";
  return /solo/i.test(team) || clean.toLowerCase().includes(team.toLowerCase()) ? clean : `${team} · ${clean}`;
}

export function mergePersonalFeed(mcs: McsFeedRow[], site: CalendarEvent[]): CalendarEvent[] {
  const hm = (t: string | null | undefined) => (t ?? "").slice(0, 5);
  const fromMcs: CalendarEvent[] = mcs.map((e) => ({
    id: `mcs-${e.key.replace(/[^A-Za-z0-9-]/g, "-")}`,
    date: e.event_date.slice(0, 10),
    startTime: e.start_time,
    endTime: e.end_time,
    kind: "activite",
    activityType: null,
    title: mcsFeedTitle(e.title, e.team),
    location: e.location,
    terrainId: null,
    category: null,
    coachNames: null
  }));
  const taken = new Set(fromMcs.map((e) => `${e.date}|${hm(e.startTime)}`));
  const extra = site
    .filter((e) => e.kind !== "essai")
    .filter((e) => !taken.has(`${e.date}|${hm(e.startTime)}`))
    .map((e) => (e.organization && !/st-?gabriel|fc elevate/i.test(e.title) ? { ...e, title: `${e.title} (${e.organization})` } : e));
  return [...fromMcs, ...extra].sort((a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : (a.startTime ?? "").localeCompare(b.startTime ?? "")));
}

export async function getPersonalCalendarEvents(from: string, to: string): Promise<CalendarEvent[]> {
  const [site, { data }] = await Promise.all([
    getUnifiedCalendarEvents(from, to),
    db().from("mcs_events").select("key, event_date, start_time, end_time, title, location, team:mcs_teams!inner(name, active)").gte("event_date", from).lte("event_date", to)
  ]);
  const rows: McsFeedRow[] = ((data ?? []) as any[])
    .filter((r) => r.team?.active !== false)
    .map((r) => ({ key: r.key, event_date: String(r.event_date), start_time: r.start_time, end_time: r.end_time, title: r.title, location: r.location, team: r.team?.name ?? "" }));
  return mergePersonalFeed(rows, site);
}
