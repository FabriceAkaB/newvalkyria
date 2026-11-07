import { CLUB_ID } from "@/lib/club";
import { readIcalWindow, zonedToUtc } from "@/lib/ical";
import { addDays, habitWeek, mondayOf, parseTags, weekTime, type CalEvent, type Habit, type HabitLog, type HabitWeek, type Meal, type MealMoment, type SourceType, type WeekTime } from "@/lib/jp-core";
import { todayIso } from "@/lib/mandalart-repo";
import { fetchIcalText } from "@/lib/mcs-calendar";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Espace JP : habitudes, nutrition, connaissances et calendrier de JP (tables `jp_*`, réglage `jp_calendar_ical`). */

function db() {
  return getSupabaseAdminClient() as any;
}

const day10 = (x: unknown) => String(x).slice(0, 10);

// ───────────────────────── Habitudes ─────────────────────────

export async function getHabits(includeInactive = false): Promise<Habit[]> {
  let q = db().from("jp_habits").select("id, name, kind, unit, target, active, sort_order").eq("club_id", CLUB_ID);
  if (!includeInactive) q = q.eq("active", true);
  const { data, error } = await q.order("sort_order").order("created_at");
  if (error) throw error;
  return ((data ?? []) as any[]).map((h) => ({ ...h, target: Number(h.target) }));
}

export async function getHabitLogs(from: string, to: string): Promise<HabitLog[]> {
  const habits = await getHabits(true);
  if (!habits.length) return [];
  const { data, error } = await db().from("jp_habit_logs").select("habit_id, day, value").in("habit_id", habits.map((h) => h.id)).gte("day", from).lte("day", to);
  if (error) throw error;
  return ((data ?? []) as any[]).map((l) => ({ habit_id: l.habit_id, day: day10(l.day), value: Number(l.value) }));
}

export interface HabitsView {
  today: string;
  weeks: HabitWeek[];
  /** 8 dernières semaines : jours réussis / jours visés, toutes habitudes. */
  history: { monday: string; score: number | null }[];
}

export async function getHabitsView(today = todayIso()): Promise<HabitsView> {
  const habits = await getHabits();
  const from = addDays(mondayOf(today), -7 * 7 - 30);
  const logs = await getHabitLogs(from, today);
  const history = Array.from({ length: 8 }, (_, i) => {
    const monday = addDays(mondayOf(today), -7 * (7 - i));
    const sunday = addDays(monday, 6);
    const ref = sunday < today ? sunday : today;
    const ws = habits.map((h) => habitWeek(h, logs, ref));
    const xs = ws.filter((w) => w.goal > 0).map((w) => Math.min(1, w.met / w.goal));
    return { monday, score: xs.length && logs.some((l) => l.day >= monday && l.day <= sunday) ? xs.reduce((s, x) => s + x, 0) / xs.length : null };
  });
  return { today, weeks: habits.map((h) => habitWeek(h, logs, today)), history };
}

export async function logHabit(habitId: string, day: string, value: number | null): Promise<void> {
  if (value === null) {
    await db().from("jp_habit_logs").delete().eq("habit_id", habitId).eq("day", day);
    return;
  }
  const { error } = await db().from("jp_habit_logs").upsert({ habit_id: habitId, day, value, updated_at: new Date().toISOString() }, { onConflict: "habit_id,day" });
  if (error) throw error;
}

export async function saveHabit(input: { id?: string; name: string; kind: "check" | "nombre"; unit?: string | null; target: number; active?: boolean }): Promise<void> {
  const row: Record<string, unknown> = { name: input.name.trim(), kind: input.kind, unit: input.unit?.trim() || null, target: input.target };
  if (input.active !== undefined) row.active = input.active;
  if (input.id) {
    const { error } = await db().from("jp_habits").update(row).eq("id", input.id).eq("club_id", CLUB_ID);
    if (error) throw error;
    return;
  }
  const { count } = await db().from("jp_habits").select("id", { count: "exact", head: true }).eq("club_id", CLUB_ID);
  const { error } = await db().from("jp_habits").insert({ ...row, club_id: CLUB_ID, sort_order: (count ?? 0) + 1 });
  if (error) throw error;
}

// ───────────────────────── Nutrition ─────────────────────────

export async function getMeals(from: string, to: string): Promise<Meal[]> {
  const { data, error } = await db().from("jp_meals").select("id, day, moment, description, protein_g, quality").eq("club_id", CLUB_ID).gte("day", from).lte("day", to).order("day", { ascending: false }).order("created_at");
  if (error) throw error;
  return ((data ?? []) as any[]).map((m) => ({ ...m, day: day10(m.day) }));
}

export async function addMeal(input: { day: string; moment: MealMoment; description: string; proteinG?: number | null; quality?: Meal["quality"] }): Promise<void> {
  const { error } = await db().from("jp_meals").insert({ club_id: CLUB_ID, day: input.day, moment: input.moment, description: input.description.trim(), protein_g: input.proteinG ?? null, quality: input.quality ?? null });
  if (error) throw error;
}

export async function deleteMeal(id: string): Promise<void> {
  const { error } = await db().from("jp_meals").delete().eq("id", id).eq("club_id", CLUB_ID);
  if (error) throw error;
}

// ───────────────────────── Connaissances ─────────────────────────

export interface Knowledge {
  id: string;
  title: string;
  source_type: SourceType;
  author: string | null;
  url: string | null;
  status: "a-lire" | "en-cours" | "fini";
  lessons: string | null;
  apply_to: string | null;
  tags: string[];
  applied: boolean;
  created_at: string;
  updated_at: string;
}

export async function getKnowledge(): Promise<Knowledge[]> {
  const { data, error } = await db().from("jp_knowledge").select("id, title, source_type, author, url, status, lessons, apply_to, tags, applied, created_at, updated_at").eq("club_id", CLUB_ID).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Knowledge[];
}

export async function saveKnowledge(input: {
  id?: string;
  title: string;
  sourceType: SourceType;
  author?: string | null;
  url?: string | null;
  status: Knowledge["status"];
  lessons?: string | null;
  applyTo?: string | null;
  tags?: string;
  applied?: boolean;
}): Promise<void> {
  const row = {
    title: input.title.trim(),
    source_type: input.sourceType,
    author: input.author?.trim() || null,
    url: input.url?.trim() || null,
    status: input.status,
    lessons: input.lessons?.trim() || null,
    apply_to: input.applyTo?.trim() || null,
    tags: parseTags(input.tags ?? ""),
    applied: input.applied ?? false,
    updated_at: new Date().toISOString()
  };
  const { error } = input.id ? await db().from("jp_knowledge").update(row).eq("id", input.id).eq("club_id", CLUB_ID) : await db().from("jp_knowledge").insert({ ...row, club_id: CLUB_ID });
  if (error) throw error;
}

export async function deleteKnowledge(id: string): Promise<void> {
  const { error } = await db().from("jp_knowledge").delete().eq("id", id).eq("club_id", CLUB_ID);
  if (error) throw error;
}

// ───────────────────────── Calendrier ─────────────────────────

const CAL_KEY = "jp_calendar_ical";

export async function getCalendarUrl(): Promise<string | null> {
  const { data } = await db().from("app_settings").select("value").eq("club_id", CLUB_ID).eq("key", CAL_KEY).maybeSingle();
  return data?.value || null;
}

/** L'« adresse secrète au format iCal » de Google Agenda (Paramètres de l'agenda → Intégrer l'agenda). */
export async function saveCalendarUrl(url: string | null): Promise<void> {
  const clean = url?.trim() || null;
  if (clean && !/^https:\/\/calendar\.google\.com\/calendar\/ical\/[^/]+\/private-[^/]+\/basic\.ics$/.test(clean)) {
    throw new Error("Colle l'« adresse secrète au format iCal » de Google Agenda (elle commence par https://calendar.google.com/calendar/ical/ et finit par basic.ics).");
  }
  if (clean) {
    const text = await fetchIcalText(clean).catch(() => null);
    if (!text || !/BEGIN:VCALENDAR/i.test(text)) throw new Error("Google Agenda ne répond pas à ce lien. Recopie l'adresse secrète.");
  }
  const { error } = await db().from("app_settings").upsert({ club_id: CLUB_ID, key: CAL_KEY, value: clean ?? "", updated_at: new Date().toISOString() }, { onConflict: "club_id,key" });
  if (error) throw error;
}

export interface CalendarView {
  connected: boolean;
  error: string | null;
  monday: string;
  events: (CalEvent & { source: "google" | "academie" })[];
  week: WeekTime;
  next: WeekTime;
}

const toMs = (date: string, time: string) => {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return zonedToUtc({ y, m, d, h, mi, s: 0 }, "America/Toronto");
};

/** Activités de l'académie où JP est inscrit comme éducateur (portail des entraîneurs). */
async function academyEvents(from: string, to: string): Promise<CalEvent[]> {
  const { data: me } = await db().from("staff_members").select("coach_id").eq("club_id", CLUB_ID).ilike("full_name", "%Jean-Paul%").not("coach_id", "is", null).limit(1).maybeSingle();
  if (!me?.coach_id) return [];
  const { data } = await db()
    .from("coach_assignments")
    .select("activity:coach_activities(title, activity_date, start_time, end_time, category)")
    .eq("coach_id", me.coach_id)
    .neq("status", "cancelled");
  return ((data ?? []) as any[])
    .map((r) => r.activity)
    .filter((a) => a && a.start_time && a.end_time && day10(a.activity_date) >= from && day10(a.activity_date) <= to)
    .map((a) => {
      const date = day10(a.activity_date);
      return { summary: `Pratique : ${a.title || a.category || "activité"}`, date, start: String(a.start_time).slice(0, 5), end: String(a.end_time).slice(0, 5), startMs: toMs(date, String(a.start_time).slice(0, 5)), endMs: toMs(date, String(a.end_time).slice(0, 5)), allDay: false };
    });
}

/** Cette semaine et la suivante : Google Agenda de JP + ses activités à l'académie, heures par catégorie. */
export async function getCalendarView(today = todayIso()): Promise<CalendarView> {
  const monday = mondayOf(today);
  const from = monday;
  const to = addDays(monday, 13);
  const url = await getCalendarUrl();
  let error: string | null = null;
  let google: CalEvent[] = [];
  if (url) {
    try {
      const text = await fetchIcalText(url);
      google = readIcalWindow(text, { from, to }).occurrences.filter((o) => !o.cancelled).map((o) => ({ summary: o.summary, date: o.date, start: o.start, end: o.end, startMs: o.startMs, endMs: o.endMs, allDay: o.allDay }));
    } catch {
      error = "Google Agenda n'a pas répondu : réessaie plus tard ou recopie l'adresse secrète.";
    }
  }
  const academy = await academyEvents(from, to).catch(() => []);
  // Une pratique déjà inscrite dans Google Agenda n'est pas comptée deux fois.
  const dup = (a: CalEvent) => google.some((g) => g.date === a.date && Math.abs(g.startMs - a.startMs) < 30 * 60_000);
  const events = [...google.map((e) => ({ ...e, source: "google" as const })), ...academy.filter((a) => !dup(a)).map((e) => ({ ...e, source: "academie" as const }))].sort((a, b) => a.startMs - b.startMs);
  return { connected: !!url, error, monday, events, week: weekTime(events, monday), next: weekTime(events, addDays(monday, 7)) };
}
