import { CLUB_ID } from "@/lib/club";
import { PASSPORT_LEVELS, TEST_CONTEXTS, type SkillTest, type TestContext, type TestResult } from "@/lib/skill-tests";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Passeport et tests de progression : catalogue des tests (skill_tests) et feuille de suivi (skill_test_results). */

function db() {
  return getSupabaseAdminClient() as any;
}

export async function getTests(opts: { activeOnly?: boolean } = {}): Promise<SkillTest[]> {
  let q = db().from("skill_tests").select("*").eq("club_id", CLUB_ID).order("sort_order").order("created_at");
  if (opts.activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as SkillTest[];
}

export interface TestPatch {
  name?: string;
  gesture?: string | null;
  unit?: string;
  higherIsBetter?: boolean;
  durationSeconds?: number | null;
  protocol?: string | null;
  thresholds?: Partial<Record<string, number | null>>;
  active?: boolean;
  validated?: boolean;
}

function toColumns(p: TestPatch): Record<string, unknown> {
  const c: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.name !== undefined) c.name = p.name.trim().slice(0, 120);
  if (p.gesture !== undefined) c.gesture = p.gesture?.trim() || null;
  if (p.unit !== undefined) c.unit = p.unit.trim().slice(0, 30) || "points";
  if (p.higherIsBetter !== undefined) c.higher_is_better = p.higherIsBetter;
  if (p.durationSeconds !== undefined) c.duration_seconds = p.durationSeconds;
  if (p.protocol !== undefined) c.protocol = p.protocol?.trim() || null;
  if (p.active !== undefined) c.active = p.active;
  if (p.validated !== undefined) c.validated_at = p.validated ? new Date().toISOString() : null;
  if (p.thresholds !== undefined) {
    const t: Record<string, number> = {};
    for (const level of PASSPORT_LEVELS) {
      const v = p.thresholds[level];
      if (v !== null && v !== undefined && Number.isFinite(Number(v))) t[level] = Number(v);
    }
    c.thresholds = t;
  }
  return c;
}

export async function createTest(p: TestPatch): Promise<string> {
  const { data: last } = await db().from("skill_tests").select("sort_order").eq("club_id", CLUB_ID).order("sort_order", { ascending: false }).limit(1);
  const { data, error } = await db()
    .from("skill_tests")
    .insert({ club_id: CLUB_ID, name: "Nouveau test", unit: "points", sort_order: (last?.[0]?.sort_order ?? 0) + 1, ...toColumns(p) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateTest(id: string, p: TestPatch): Promise<void> {
  const { error } = await db().from("skill_tests").update(toColumns(p)).eq("id", id).eq("club_id", CLUB_ID);
  if (error) throw new Error(error.message);
}

/* ── Joueuses de la saison, par groupe (plage horaire) ─────────────── */

export interface TestPlayer {
  registrationId: string;
  playerId: string | null;
  firstName: string;
  lastName: string;
  group: string;
  groupKey: string;
  photoUrl: string | null;
}

const DAY_ORDER: Record<string, number> = { Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6, Dimanche: 7 };

export async function getSeasonPlayers(): Promise<TestPlayer[]> {
  const { data: season } = await db().from("seasons").select("id").eq("is_active", true).maybeSingle();
  const [{ data: regs, error }, { data: slots }] = await Promise.all([
    db()
      .from("registrations")
      .select("id, player_id, player_first_name, player_last_name, category_id, time_slot_template_id, players(photo_url)")
      .eq("season_id", season?.id ?? "automne-hiver-2026")
      .eq("status", "paid")
      .eq("is_trial", false),
    db().from("time_slot_templates").select("id, day, start_time, location")
  ]);
  if (error) throw new Error(error.message);
  const slotOf = new Map(((slots ?? []) as any[]).map((s) => [s.id, s]));
  return ((regs ?? []) as any[])
    .map((r) => {
      const s = slotOf.get(r.time_slot_template_id);
      return {
        registrationId: r.id,
        playerId: r.player_id ?? null,
        firstName: (r.player_first_name ?? "").trim(),
        lastName: (r.player_last_name ?? "").trim(),
        group: s ? `${s.day} ${String(s.start_time).slice(0, 5)} · ${r.category_id ?? ""}` : `Filles ${r.category_id ?? ""} (sans plage)`,
        groupKey: s ? `${DAY_ORDER[s.day] ?? 9}-${String(s.start_time).slice(0, 5)}-${s.id}` : `9-${r.category_id ?? ""}`,
        photoUrl: r.players?.photo_url ?? null
      };
    })
    .sort((a, b) => a.groupKey.localeCompare(b.groupKey) || a.firstName.localeCompare(b.firstName, "fr"));
}

/* ── Feuille de suivi ─────────────────────────────────────────────── */

export async function getResults(registrationIds?: string[]): Promise<(TestResult & { id: string })[]> {
  let q = db().from("skill_test_results").select("id, test_id, registration_id, tested_on, context, score, video_url, note").eq("club_id", CLUB_ID).order("tested_on");
  if (registrationIds) {
    if (!registrationIds.length) return [];
    q = q.in("registration_id", registrationIds);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((r) => ({ ...r, tested_on: String(r.tested_on).slice(0, 10), score: Number(r.score) }));
}

export interface ResultInput {
  registrationId: string;
  testId: string;
  testedOn: string;
  context: TestContext;
  score: number;
  videoUrl: string | null;
  note: string | null;
}

/** Enregistre des résultats (une saisie du même jour et du même type corrige la précédente). */
export async function saveResults(entries: ResultInput[], coachId: string | null = null): Promise<number> {
  if (!entries.length) return 0;
  const { data: regs } = await db().from("registrations").select("id, player_id").in("id", [...new Set(entries.map((e) => e.registrationId))]);
  const playerOf = new Map(((regs ?? []) as any[]).map((r) => [r.id, r.player_id ?? null]));
  const now = new Date().toISOString();
  const rows = entries
    .filter((e) => TEST_CONTEXTS.includes(e.context) && /^\d{4}-\d{2}-\d{2}$/.test(e.testedOn) && playerOf.has(e.registrationId))
    .map((e) => ({
      club_id: CLUB_ID,
      registration_id: e.registrationId,
      player_id: playerOf.get(e.registrationId),
      test_id: e.testId,
      tested_on: e.testedOn,
      context: e.context,
      score: e.score,
      video_url: e.videoUrl?.trim() || null,
      note: e.note?.trim() || null,
      coach_id: coachId,
      updated_at: now
    }));
  if (!rows.length) return 0;
  const { error } = await db().from("skill_test_results").upsert(rows, { onConflict: "registration_id,test_id,tested_on,context" });
  if (error) throw new Error(error.message);
  return rows.length;
}

export async function deleteResult(id: string): Promise<void> {
  const { error } = await db().from("skill_test_results").delete().eq("id", id).eq("club_id", CLUB_ID);
  if (error) throw new Error(error.message);
}
