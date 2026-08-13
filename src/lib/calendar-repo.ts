import { getActivities } from "@/lib/coaches-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export interface CalendarEvent {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  kind: "activite" | "essai";
  activityType: string | null;
  title: string;
  location: string | null;
  terrainId: string | null;
}

/** Calendrier unifié — combine les activités entraîneurs (pratiques, matchs,
 *  tournois...) et les essais des deux systèmes d'inscription (leads Été +
 *  registrations Automne/Hiver+), sur une plage de dates donnée. Ne couvre
 *  pas encore les séances Solo (calendrier dédié déjà existant sous chaque saison). */
export async function getUnifiedCalendarEvents(from: string, to: string): Promise<CalendarEvent[]> {
  const [activities, regTrialsRes, leadTrialsRes] = await Promise.all([
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
      .lte("trial_date", to)
  ]);

  const activityEvents: CalendarEvent[] = activities.map((a) => ({
    id: a.id,
    date: a.activity_date,
    startTime: a.start_time,
    endTime: a.end_time,
    kind: "activite",
    activityType: a.activity_type,
    title: a.title || a.activity_type,
    location: a.location,
    terrainId: a.terrain_id
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
    terrainId: null
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
      terrainId: null
    };
  });

  return [...activityEvents, ...regTrialEvents, ...leadTrialEvents].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.startTime ?? "").localeCompare(b.startTime ?? "");
  });
}
