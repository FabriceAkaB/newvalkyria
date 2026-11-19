import { checkIncident, incidentTaskTitle, kindLabel, type IncidentInput, type IncidentStatus } from "@/lib/player-incidents";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { syncRefTask } from "@/lib/team-tasks-repo";

/** Fiches de blessure (table `player_incidents`, privée : Loi 25). Chaque fiche ouverte = une tâche de JP
 *  (ref `blessure:<id>`), cochée quand la joueuse est de retour au jeu. */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface PlayerIncident {
  id: string;
  activityId: string | null;
  activityDate: string | null;
  activityLabel: string | null;
  registrationId: string;
  playerName: string;
  reportedBy: string | null;
  kind: string;
  bodyPart: string | null;
  description: string;
  firstAid: string | null;
  stoppedPlaying: boolean;
  parentNotified: boolean;
  status: IncidentStatus;
  followUp: string | null;
  returnOn: string | null;
  createdAt: string;
}

const map = (r: any): PlayerIncident => ({
  id: r.id,
  activityId: r.activity_id,
  activityDate: r.activity?.activity_date ? String(r.activity.activity_date).slice(0, 10) : null,
  activityLabel: r.activity ? r.activity.title || r.activity.category || null : null,
  registrationId: r.registration_id,
  playerName: r.player_name,
  reportedBy: r.reported_by,
  kind: r.kind,
  bodyPart: r.body_part,
  description: r.description,
  firstAid: r.first_aid,
  stoppedPlaying: !!r.stopped_playing,
  parentNotified: !!r.parent_notified,
  status: r.status,
  followUp: r.follow_up,
  returnOn: r.return_on,
  createdAt: r.created_at
});

const SELECT = "*, activity:coach_activities(activity_date, title, category)";

function taskDetails(i: PlayerIncident, parent?: { name: string | null; phone: string | null } | null): string {
  return [
    `${kindLabel(i.kind)}${i.bodyPart ? ` (${i.bodyPart})` : ""}${i.activityDate ? ` à la pratique du ${i.activityDate}` : ""}, signalée par ${i.reportedBy ?? "l'éducateur"}.`,
    `Ce qui s'est passé : ${i.description}`,
    i.firstAid ? `Premiers soins : ${i.firstAid}` : null,
    i.stoppedPlaying ? "Elle a arrêté de jouer." : "Elle a continué à jouer.",
    i.parentNotified ? "Parent avisé sur place." : "Parent PAS encore avisé : l'appeler aujourd'hui.",
    parent?.phone ? `Parent : ${parent.name ?? ""} ${parent.phone}`.trim() : null,
    "Fiche complète : Coaching › Joueuses › Blessures (/admin/coaching/blessures)."
  ]
    .filter(Boolean)
    .join("\n");
}

/** Contact d'urgence de chaque joueuse : le parent de l'inscription, et la fiche de la joueuse si elle est remplie. */
export async function getEmergencyContacts(registrationIds: string[]): Promise<Record<string, { parentName: string | null; parentPhone: string | null; emergencyName: string | null; emergencyPhone: string | null; medicalNotes: string | null }>> {
  if (!registrationIds.length) return {};
  const { data } = await db()
    .from("registrations")
    .select("id, parent_name, parent_phone, player:players(emergency_contact_name, emergency_contact_phone, medical_notes)")
    .in("id", registrationIds);
  const out: Record<string, { parentName: string | null; parentPhone: string | null; emergencyName: string | null; emergencyPhone: string | null; medicalNotes: string | null }> = {};
  for (const r of (data ?? []) as any[]) {
    out[r.id] = {
      parentName: r.parent_name ?? null,
      parentPhone: r.parent_phone ?? null,
      emergencyName: r.player?.emergency_contact_name ?? null,
      emergencyPhone: r.player?.emergency_contact_phone ?? null,
      medicalNotes: r.player?.medical_notes ?? null
    };
  }
  return out;
}

export async function getActivityIncidents(activityId: string): Promise<PlayerIncident[]> {
  const { data, error } = await db().from("player_incidents").select(SELECT).eq("activity_id", activityId).order("created_at");
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map(map);
}

export async function listIncidents(opts: { openOnly?: boolean } = {}): Promise<PlayerIncident[]> {
  let q = db().from("player_incidents").select(SELECT).order("created_at", { ascending: false }).limit(200);
  if (opts.openOnly) q = q.neq("status", "fermee");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map(map);
}

/** L'éducateur signale une blessure : la fiche est gardée et JP reçoit sa tâche (appeler la famille) pour aujourd'hui. */
export async function reportIncident(input: { activityId: string; coachId: string | null; reportedBy: string; playerName: string; incident: IncidentInput }): Promise<PlayerIncident> {
  const i = input.incident;
  const { data, error } = await db()
    .from("player_incidents")
    .insert({
      activity_id: input.activityId,
      registration_id: i.registrationId,
      player_name: input.playerName,
      coach_id: input.coachId,
      reported_by: input.reportedBy,
      kind: i.kind,
      body_part: i.bodyPart ?? null,
      description: i.description,
      first_aid: i.firstAid ?? null,
      stopped_playing: !!i.stoppedPlaying,
      parent_notified: !!i.parentNotified
    })
    .select(SELECT)
    .single();
  if (error) throw new Error(error.message);
  const incident = map(data);
  const contacts = await getEmergencyContacts([i.registrationId]).catch(() => ({}) as Record<string, never>);
  const c = (contacts as Record<string, { parentName: string | null; parentPhone: string | null }>)[i.registrationId];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  await syncRefTask(`blessure:${incident.id}`, { title: incidentTaskTitle(incident), details: taskDetails(incident, c ? { name: c.parentName, phone: c.parentPhone } : null), due: today }).catch(() => null);
  return incident;
}

/** Suivi par JP ou la gérante : statut, notes de suivi, date de retour au jeu. « De retour au jeu » coche la tâche. */
export async function updateIncident(id: string, patch: { status?: unknown; followUp?: unknown; returnOn?: unknown; parentNotified?: unknown }): Promise<PlayerIncident> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status === "ouverte" || patch.status === "suivi" || patch.status === "fermee") row.status = patch.status;
  if (typeof patch.followUp === "string") row.follow_up = patch.followUp.trim().slice(0, 2000) || null;
  if (typeof patch.returnOn === "string") row.return_on = /^\d{4}-\d{2}-\d{2}$/.test(patch.returnOn) ? patch.returnOn : null;
  if (typeof patch.parentNotified === "boolean") row.parent_notified = patch.parentNotified;
  const { data, error } = await db().from("player_incidents").update(row).eq("id", id).select(SELECT).single();
  if (error) throw new Error(error.message);
  const incident = map(data);
  if (incident.status === "fermee") await syncRefTask(`blessure:${id}`, { title: incidentTaskTitle(incident), done: true, doneNote: incident.followUp ?? "De retour au jeu" }).catch(() => null);
  else await syncRefTask(`blessure:${id}`, { title: incidentTaskTitle(incident), details: taskDetails(incident) }).catch(() => null);
  return incident;
}

export { checkIncident };
