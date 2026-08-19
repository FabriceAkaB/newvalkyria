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
    coachNames: coachNamesByActivity.get(a.id) ?? null
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
