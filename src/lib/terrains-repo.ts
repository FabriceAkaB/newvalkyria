import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export interface Terrain {
  id: string;
  name: string;
  address: string | null;
  active: boolean;
  created_at: string;
}

export async function getTerrains(): Promise<Terrain[]> {
  const { data, error } = await db().from("terrains").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Terrain[];
}

export async function createTerrain(input: { name: string; address: string | null }): Promise<string> {
  const { data, error } = await db().from("terrains").insert({ name: input.name, address: input.address }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateTerrain(id: string, patch: Partial<{ name: string; address: string | null; active: boolean }>): Promise<void> {
  const { error } = await db().from("terrains").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTerrain(id: string): Promise<void> {
  const { error } = await db().from("terrains").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface TerrainConflict {
  activityId: string;
  title: string | null;
  activityType: string;
  startTime: string;
  endTime: string;
}

/** Deux plages se chevauchent si l'une commence avant que l'autre finisse,
 *  dans les deux sens — comparaison de chaînes "HH:MM" valide car même
 *  format à largeur fixe des deux côtés. */
export async function findTerrainConflicts(input: {
  terrainId: string;
  activityDate: string;
  startTime: string;
  endTime: string;
  excludeActivityId?: string;
}): Promise<TerrainConflict[]> {
  let query = db()
    .from("coach_activities")
    .select("id, title, activity_type, start_time, end_time")
    .eq("terrain_id", input.terrainId)
    .eq("activity_date", input.activityDate)
    .lt("start_time", input.endTime)
    .gt("end_time", input.startTime);
  if (input.excludeActivityId) query = query.neq("id", input.excludeActivityId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ activityId: r.id, title: r.title, activityType: r.activity_type, startTime: r.start_time, endTime: r.end_time }));
}
