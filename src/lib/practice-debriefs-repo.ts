import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Retour de l'éducateur sur la pratique (table `practice_debriefs`) : ce qu'on a bien fait, ce qu'on a moins bien
 *  fait, ce qu'on change la prochaine fois. Le dernier retour du même groupe revient avant la pratique suivante. */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface PracticeDebrief {
  id: string;
  activityId: string;
  coachId: string;
  coachName: string;
  wentWell: string | null;
  toImprove: string | null;
  nextTime: string | null;
  updatedAt: string;
  /** Pour le retour précédent : la date de la pratique. */
  date?: string;
}

const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 2000) : null);

function map(r: any): PracticeDebrief {
  return {
    id: r.id,
    activityId: r.activity_id,
    coachId: r.coach_id,
    coachName: `${r.coach?.first_name ?? ""} ${r.coach?.last_name ?? ""}`.trim() || "Éducateur",
    wentWell: r.went_well,
    toImprove: r.to_improve,
    nextTime: r.next_time,
    updatedAt: r.updated_at,
    date: r.activity?.activity_date ? String(r.activity.activity_date).slice(0, 10) : undefined
  };
}

export async function getDebriefs(activityIds: string[]): Promise<PracticeDebrief[]> {
  if (!activityIds.length) return [];
  const { data, error } = await db().from("practice_debriefs").select("*, coach:coaches(first_name, last_name)").in("activity_id", activityIds).order("updated_at");
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).filter((r) => r.went_well || r.to_improve || r.next_time).map(map);
}

export async function saveDebrief(activityId: string, coachId: string, input: { wentWell?: unknown; toImprove?: unknown; nextTime?: unknown }): Promise<void> {
  const row = { activity_id: activityId, coach_id: coachId, went_well: clean(input.wentWell), to_improve: clean(input.toImprove), next_time: clean(input.nextTime), updated_at: new Date().toISOString() };
  const { error } = await db().from("practice_debriefs").upsert(row, { onConflict: "activity_id,coach_id" });
  if (error) throw new Error(error.message);
}

/** Les retours de la dernière pratique du même groupe, avant celle-ci (pour s'améliorer d'une fois à l'autre). */
export async function getPreviousGroupDebriefs(activity: { id: string; activity_date: string; category?: string | null; title?: string | null }): Promise<PracticeDebrief[]> {
  const date = String(activity.activity_date).slice(0, 10);
  const key = activity.category || activity.title;
  if (!key) return [];
  const col = activity.category ? "category" : "title";
  const { data: prev } = await db()
    .from("coach_activities")
    .select("id, activity_date")
    .eq(col, key)
    .is("organization", null)
    .lt("activity_date", date)
    .order("activity_date", { ascending: false })
    .limit(6);
  const ids = ((prev ?? []) as any[]).map((a) => a.id);
  if (!ids.length) return [];
  const { data, error } = await db().from("practice_debriefs").select("*, coach:coaches(first_name, last_name), activity:coach_activities(activity_date)").in("activity_id", ids);
  if (error) throw new Error(error.message);
  const all = ((data ?? []) as any[]).filter((r) => r.went_well || r.to_improve || r.next_time).map(map);
  const latest = all.map((d) => d.date ?? "").sort().pop();
  return latest ? all.filter((d) => d.date === latest) : [];
}

/** Guide de l'éducateur : les cases cochées avant la pratique (coach-guide.ts). */
export async function getChecklist(activityId: string, coachId: string): Promise<string[]> {
  const { data } = await db().from("practice_debriefs").select("checklist").eq("activity_id", activityId).eq("coach_id", coachId).maybeSingle();
  return Array.isArray(data?.checklist) ? (data.checklist as string[]) : [];
}

export async function saveChecklist(activityId: string, coachId: string, items: string[]): Promise<void> {
  const now = new Date().toISOString();
  const { data: row } = await db().from("practice_debriefs").select("id").eq("activity_id", activityId).eq("coach_id", coachId).maybeSingle();
  const { error } = row
    ? await db().from("practice_debriefs").update({ checklist: items, checklist_at: now }).eq("id", row.id)
    : await db().from("practice_debriefs").insert({ activity_id: activityId, coach_id: coachId, checklist: items, checklist_at: now });
  if (error) throw new Error(error.message);
}
