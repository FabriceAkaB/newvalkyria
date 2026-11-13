import { CLUB_ID } from "@/lib/club";
import { SHOOT_IDEAS, type Shoot, type ShootStatus } from "@/lib/video-shoots-core";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Tournages de JP : jp_video_shoots. Règles et idées : video-shoots-core.ts. */

const db = () => getSupabaseAdminClient() as any;
const COLS = "id, title, series, status, shoot_on, shoot_time, place, message, hook, shots, people, gear, format, mandalart_code, note, sort_order, publish_on, post_kind, angle, networks, filmed_by";

/** Liste les tournages ; la première fois, range les idées du plan de vidéos explicatives. */
export async function getShoots(): Promise<Shoot[]> {
  const { data, error } = await db().from("jp_video_shoots").select(COLS).eq("club_id", CLUB_ID);
  if (error) throw error;
  if ((data ?? []).length) return data as Shoot[];
  const rows = SHOOT_IDEAS.map((i, n) => ({ club_id: CLUB_ID, title: i.title, series: i.series, message: i.message, mandalart_code: i.code, status: "idee", sort_order: n }));
  const { data: seeded, error: e2 } = await db().from("jp_video_shoots").insert(rows).select(COLS);
  if (e2) throw e2;
  return seeded as Shoot[];
}

export interface ShootInput {
  id?: string;
  title: string;
  series: string;
  status?: ShootStatus;
  shootOn?: string | null;
  shootTime?: string | null;
  place?: string | null;
  message?: string | null;
  hook?: string | null;
  shots?: string | null;
  people?: string | null;
  gear?: string | null;
  format?: string | null;
  note?: string | null;
  publishOn?: string | null;
  postKind?: string | null;
  angle?: string | null;
  networks?: string[] | null;
  filmedBy?: string | null;
}

const clean = (v: string | null | undefined) => (v ?? "").trim() || null;

export async function saveShoot(input: ShootInput): Promise<void> {
  const row: Record<string, unknown> = {
    title: input.title.trim(),
    series: input.series,
    shoot_on: input.shootOn || null,
    shoot_time: clean(input.shootTime),
    place: clean(input.place),
    message: clean(input.message),
    hook: clean(input.hook),
    shots: clean(input.shots),
    people: clean(input.people),
    gear: clean(input.gear),
    format: clean(input.format),
    note: clean(input.note),
    updated_at: new Date().toISOString()
  };
  if (input.publishOn !== undefined) row.publish_on = input.publishOn || null;
  if (input.postKind !== undefined) row.post_kind = input.postKind || "organique";
  if (input.angle !== undefined) row.angle = clean(input.angle);
  if (input.networks !== undefined) row.networks = input.networks ?? [];
  if (input.filmedBy !== undefined) row.filmed_by = clean(input.filmedBy);
  // Une idée qui reçoit un jour devient « planifiée ».
  if (input.status) row.status = input.status;
  else if (input.shootOn) row.status = "planifie";
  const q = input.id ? db().from("jp_video_shoots").update(row).eq("club_id", CLUB_ID).eq("id", input.id) : db().from("jp_video_shoots").insert({ ...row, club_id: CLUB_ID, status: row.status ?? "idee" });
  const { error } = await q;
  if (error) throw error;
}

export async function setShootStatus(id: string, status: ShootStatus): Promise<void> {
  const { error } = await db().from("jp_video_shoots").update({ status, updated_at: new Date().toISOString() }).eq("club_id", CLUB_ID).eq("id", id);
  if (error) throw error;
}

export async function deleteShoot(id: string): Promise<void> {
  const { error } = await db().from("jp_video_shoots").delete().eq("club_id", CLUB_ID).eq("id", id);
  if (error) throw error;
}
