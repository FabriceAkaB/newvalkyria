import { CLUB_ID } from "@/lib/club";
import { TRAINING_MODULES, type TrainingRow } from "@/lib/coach-training";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Formation des éducateurs : lu et compris (l'éducateur), validé (JP). Règles : coach-training.ts. */

function db() {
  return getSupabaseAdminClient() as any;
}
const known = (m: string) => TRAINING_MODULES.some((x) => x.key === m);

export async function getTraining(coachIds: string[]): Promise<Map<string, TrainingRow[]>> {
  const out = new Map<string, TrainingRow[]>();
  if (!coachIds.length) return out;
  const { data, error } = await db().from("coach_training").select("coach_id, module, read_at, validated_at").in("coach_id", coachIds);
  if (error) throw new Error(error.message);
  for (const r of (data ?? []) as any[]) out.set(r.coach_id, [...(out.get(r.coach_id) ?? []), { module: r.module, read_at: r.read_at, validated_at: r.validated_at }]);
  return out;
}

/** L'éducateur confirme avoir lu et compris un module. */
export async function markModuleRead(coachId: string, module: string): Promise<void> {
  if (!known(module)) throw new Error("Module inconnu");
  const now = new Date().toISOString();
  const { error } = await db().from("coach_training").upsert({ club_id: CLUB_ID, coach_id: coachId, module, read_at: now, updated_at: now }, { onConflict: "coach_id,module" });
  if (error) throw new Error(error.message);
}

/** JP valide (ou retire la validation d') un module, après avoir observé l'éducateur. */
export async function setModuleValidated(coachId: string, module: string, on: boolean, note: string | null): Promise<void> {
  if (!known(module)) throw new Error("Module inconnu");
  const now = new Date().toISOString();
  const { data: cur } = await db().from("coach_training").select("read_at").eq("coach_id", coachId).eq("module", module).maybeSingle();
  const { error } = await db()
    .from("coach_training")
    .upsert({ club_id: CLUB_ID, coach_id: coachId, module, read_at: cur?.read_at ?? now, validated_at: on ? now : null, validation_note: note, updated_at: now }, { onConflict: "coach_id,module" });
  if (error) throw new Error(error.message);
}

/* ── Modules ouverts (JP, 19 nov. 2026) : un module reste « bientôt disponible » tant que JP ne l'a pas ouvert. ── */

const OPEN_KEY = "formation_modules_ouverts";

export async function getOpenModules(): Promise<string[]> {
  const { data } = await db().from("app_settings").select("value").eq("club_id", CLUB_ID).eq("key", OPEN_KEY).maybeSingle();
  try {
    const v = JSON.parse(String(data?.value ?? "[]"));
    return Array.isArray(v) ? v.filter((x: unknown): x is string => typeof x === "string" && known(x)) : [];
  } catch {
    return [];
  }
}

export async function setModuleOpen(module: string, on: boolean): Promise<string[]> {
  if (!known(module)) throw new Error("Module inconnu");
  const cur = new Set(await getOpenModules());
  if (on) cur.add(module);
  else cur.delete(module);
  const next = TRAINING_MODULES.map((m) => m.key).filter((k) => cur.has(k));
  const { error } = await db().from("app_settings").upsert({ club_id: CLUB_ID, key: OPEN_KEY, value: JSON.stringify(next), updated_at: new Date().toISOString() }, { onConflict: "club_id,key" });
  if (error) throw new Error(error.message);
  return next;
}
