import { CLUB_ID } from "@/lib/club";
import { readIcalWindow } from "@/lib/ical";
import { fetchIcalText, maskIcalUrl, mcsEventFromOccurrence, McsCalendarError, normalizeIcalUrl } from "@/lib/mcs-calendar";
import { opponentOf, slotConflict, type McsEventLite, type SlotForConflict } from "@/lib/mcs-teams";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Les équipes MonClubSportif et leurs événements (lecture par le lien « Sync » de chaque équipe, agent A12). */

function db() {
  return getSupabaseAdminClient() as any;
}

const TZ = "America/Toronto";
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
/** Fenêtre lue : hier jusqu'à 10 semaines, assez pour vendre les plages d'avance. */
const WINDOW_DAYS = 70;

export interface McsTeam {
  id: string;
  name: string;
  birth_years: number[];
  gender: "filles" | "garcons" | "mixte";
  urlMasked: string | null;
  active: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  events_count: number;
}

export interface McsEvent extends McsEventLite {
  team_id: string;
  key: string;
  location: string | null;
  opponent: string | null;
}

export async function listTeams(): Promise<McsTeam[]> {
  const { data, error } = await db().from("mcs_teams").select("*").eq("club_id", CLUB_ID).order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((t) => ({ ...t, ical_url: undefined, urlMasked: t.ical_url ? maskIcalUrl(t.ical_url) : null }));
}

export async function saveTeam(input: { id?: string; name: string; birthYears: number[]; gender: McsTeam["gender"]; icalUrl?: string | null; active?: boolean }): Promise<string> {
  const row: Record<string, unknown> = { club_id: CLUB_ID, name: input.name.trim().slice(0, 120), birth_years: input.birthYears, gender: input.gender };
  if (input.active !== undefined) row.active = input.active;
  if (input.icalUrl !== undefined) {
    if (input.icalUrl === null || input.icalUrl === "") row.ical_url = null;
    else {
      const n = normalizeIcalUrl(input.icalUrl);
      if (!n.ok) throw new McsCalendarError(n.error, "format");
      row.ical_url = n.url;
    }
  }
  if (input.id) {
    const { error } = await db().from("mcs_teams").update(row).eq("id", input.id).eq("club_id", CLUB_ID);
    if (error) throw new Error(error.message);
    return input.id;
  }
  const { data, error } = await db().from("mcs_teams").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function deleteTeam(id: string): Promise<void> {
  const { error } = await db().from("mcs_teams").delete().eq("id", id).eq("club_id", CLUB_ID);
  if (error) throw new Error(error.message);
}

/** Relit le calendrier d'une équipe et remplace ses événements de la fenêtre. Une erreur est notée sur l'équipe. */
export async function syncTeam(teamId: string, timeoutMs = 10_000): Promise<{ ok: boolean; events: number; error?: string }> {
  const { data: team } = await db().from("mcs_teams").select("id, ical_url").eq("id", teamId).maybeSingle();
  if (!team?.ical_url) return { ok: false, events: 0, error: "Pas de lien « Sync » pour cette équipe." };
  const now = new Date().toISOString();
  try {
    const text = await fetchIcalText(team.ical_url, timeoutMs);
    const from = addDays(todayIso(), -1);
    const { occurrences } = readIcalWindow(text, { from, to: addDays(from, WINDOW_DAYS) });
    // Les pratiques annulées dans MonClubSportif ne comptent pas (statut annulé ou titre « [Annulé] »).
    const live = occurrences.filter((o) => !o.cancelled && !/^\s*\[(?:annul|cancel)/i.test(o.summary ?? ""));
    const rows = live.map((o) => {
      const e = mcsEventFromOccurrence(o);
      return { team_id: teamId, key: e.key, event_date: e.date, start_time: o.start ?? null, end_time: e.end, title: e.title.slice(0, 300), location: e.location || null, type: e.type, opponent: e.type === "Match" ? opponentOf(e.title) : null, synced_at: now };
    });
    await db().from("mcs_events").delete().eq("team_id", teamId);
    if (rows.length) {
      const { error } = await db().from("mcs_events").upsert(rows, { onConflict: "team_id,key" });
      if (error) throw new Error(error.message);
    }
    await db().from("mcs_teams").update({ last_sync_at: now, last_error: null, events_count: rows.length }).eq("id", teamId);
    return { ok: true, events: rows.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Lecture impossible.";
    await db().from("mcs_teams").update({ last_sync_at: now, last_error: message }).eq("id", teamId);
    return { ok: false, events: 0, error: message };
  }
}

/** Relit les équipes dont la dernière lecture date de plus de `maxAgeMin` (en parallèle, sans bloquer longtemps). */
export async function syncStaleTeams(maxAgeMin = 15, timeoutMs = 6_000): Promise<number> {
  const { data } = await db().from("mcs_teams").select("id, last_sync_at, ical_url, active").eq("club_id", CLUB_ID).eq("active", true).not("ical_url", "is", null);
  const stale = ((data ?? []) as any[]).filter((t) => !t.last_sync_at || Date.now() - Date.parse(t.last_sync_at) > maxAgeMin * 60_000);
  await Promise.all(stale.map((t) => syncTeam(t.id, timeoutMs).catch(() => null)));
  return stale.length;
}

export async function getUpcomingEvents(days = WINDOW_DAYS): Promise<McsEvent[]> {
  const from = todayIso();
  const { data, error } = await db()
    .from("mcs_events")
    .select("team_id, key, event_date, start_time, end_time, title, location, type, opponent")
    .gte("event_date", from)
    .lte("event_date", addDays(from, days))
    .order("event_date")
    .order("start_time");
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((e) => ({ ...e, date: String(e.event_date).slice(0, 10), start: e.start_time, end: e.end_time }));
}

/** Pour chaque plage de match, l'événement MonClubSportif qui l'empêche d'être vendue (null si libre). */
export async function getSlotConflicts<T extends SlotForConflict & { id: string }>(slots: T[]): Promise<Map<string, { team: string; event: McsEventLite }>> {
  const out = new Map<string, { team: string; event: McsEventLite }>();
  if (!slots.length) return out;
  const [{ data: teams }, events] = await Promise.all([
    db().from("mcs_teams").select("id, name, birth_years, gender").eq("club_id", CLUB_ID).eq("active", true),
    getUpcomingEvents().catch(() => [] as McsEvent[])
  ]);
  if (!teams?.length || !events.length) return out;
  for (const s of slots) {
    const c = slotConflict({ ...s, slot_date: String(s.slot_date).slice(0, 10) }, teams as any[], events);
    if (c) out.set(s.id, c);
  }
  return out;
}
