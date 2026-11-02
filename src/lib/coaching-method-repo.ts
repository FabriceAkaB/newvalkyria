import { CLUB_ID } from "@/lib/club";
import { DEFAULT_PRINCIPLES, DEFAULT_STRUCTURE, GESTURE_FAMILIES, PROGRESSION_STEPS, type Gesture, type Principle, type StructureBlock } from "@/lib/coaching-method";
import { PASSPORT_LEVELS } from "@/lib/skill-tests";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Méthode Valkyria : documents (structure de séance, principes) et bibliothèque des gestes. */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface MethodDoc<T> {
  slug: string;
  title: string;
  content: T;
  validatedAt: string | null;
  updatedAt: string | null;
  /** Vrai tant que JP n'a rien enregistré : c'est la proposition de départ tirée du plan. */
  isProposal: boolean;
}

const DEFAULTS = {
  structure: { title: "Structure de séance", content: { blocks: DEFAULT_STRUCTURE } },
  principes: { title: "Principes de la pédagogie Valkyria", content: { items: DEFAULT_PRINCIPLES } }
} as const;
export type MethodSlug = keyof typeof DEFAULTS;

export async function getMethodDoc<T = unknown>(slug: MethodSlug): Promise<MethodDoc<T>> {
  const { data } = await db().from("coaching_method_docs").select("*").eq("club_id", CLUB_ID).eq("slug", slug).maybeSingle();
  if (!data) return { slug, title: DEFAULTS[slug].title, content: DEFAULTS[slug].content as T, validatedAt: null, updatedAt: null, isProposal: true };
  return { slug, title: data.title, content: data.content as T, validatedAt: data.validated_at, updatedAt: data.updated_at, isProposal: false };
}

export async function getStructure() {
  const doc = await getMethodDoc<{ blocks: StructureBlock[] }>("structure");
  return { ...doc, blocks: doc.content.blocks ?? [] };
}

export async function getPrinciples() {
  const doc = await getMethodDoc<{ items: Principle[] }>("principes");
  return { ...doc, items: doc.content.items ?? [] };
}

export async function saveMethodDoc(slug: MethodSlug, content: unknown, validated?: boolean): Promise<void> {
  const row: Record<string, unknown> = { club_id: CLUB_ID, slug, title: DEFAULTS[slug].title, content, updated_at: new Date().toISOString() };
  if (validated !== undefined) row.validated_at = validated ? new Date().toISOString() : null;
  const { error } = await db().from("coaching_method_docs").upsert(row, { onConflict: "club_id,slug" });
  if (error) throw new Error(error.message);
}

/* ── Gestes ───────────────────────────────────────────────────────── */

export async function getGestures(opts: { activeOnly?: boolean } = {}): Promise<Gesture[]> {
  let q = db().from("method_gestures").select("*").eq("club_id", CLUB_ID).order("family").order("sort_order").order("name");
  if (opts.activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as any[]).map((g) => ({ ...g, key_points: g.key_points ?? [], progression: g.progression ?? {} })) as Gesture[];
}

export interface GestureInput {
  name?: string;
  family?: string;
  passportLevel?: string | null;
  execution?: string | null;
  keyPoints?: string[];
  commonMistakes?: string | null;
  videoUrl?: string | null;
  progression?: Record<string, string>;
  active?: boolean;
  validated?: boolean;
}

export function parseGestureInput(body: Record<string, unknown>): GestureInput | string {
  const g: GestureInput = {};
  const text = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) || null : null);
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) return "Donne un nom au geste.";
    g.name = body.name.trim().slice(0, 120);
  }
  if (body.family !== undefined) {
    if (!GESTURE_FAMILIES.some((f) => f.key === body.family)) return "Famille de geste inconnue.";
    g.family = body.family as string;
  }
  if (body.passportLevel !== undefined) {
    if (body.passportLevel !== null && body.passportLevel !== "" && !(PASSPORT_LEVELS as readonly string[]).includes(String(body.passportLevel))) return "Niveau inconnu.";
    g.passportLevel = body.passportLevel ? String(body.passportLevel) : null;
  }
  if (body.execution !== undefined) g.execution = text(body.execution);
  if (body.commonMistakes !== undefined) g.commonMistakes = text(body.commonMistakes);
  if (body.videoUrl !== undefined) {
    const v = text(body.videoUrl, 500);
    if (v && !/^https?:\/\//.test(v)) return "Le lien de la vidéo doit commencer par https://.";
    g.videoUrl = v;
  }
  if (Array.isArray(body.keyPoints)) g.keyPoints = body.keyPoints.map((k) => String(k ?? "").trim().slice(0, 300)).slice(0, 5);
  if (body.progression && typeof body.progression === "object") {
    const p: Record<string, string> = {};
    for (const s of PROGRESSION_STEPS) {
      const v = (body.progression as Record<string, unknown>)[s.key];
      if (typeof v === "string" && v.trim()) p[s.key] = v.trim().slice(0, 1000);
    }
    g.progression = p;
  }
  if (typeof body.active === "boolean") g.active = body.active;
  if (typeof body.validated === "boolean") g.validated = body.validated;
  return g;
}

function toColumns(g: GestureInput): Record<string, unknown> {
  const c: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (g.name !== undefined) c.name = g.name;
  if (g.family !== undefined) c.family = g.family;
  if (g.passportLevel !== undefined) c.passport_level = g.passportLevel;
  if (g.execution !== undefined) c.execution = g.execution;
  if (g.keyPoints !== undefined) c.key_points = g.keyPoints;
  if (g.commonMistakes !== undefined) c.common_mistakes = g.commonMistakes;
  if (g.videoUrl !== undefined) c.video_url = g.videoUrl;
  if (g.progression !== undefined) c.progression = g.progression;
  if (g.active !== undefined) c.active = g.active;
  if (g.validated !== undefined) c.validated_at = g.validated ? new Date().toISOString() : null;
  return c;
}

export async function createGesture(g: GestureInput): Promise<string> {
  const { data, error } = await db()
    .from("method_gestures")
    .insert({ club_id: CLUB_ID, name: g.name ?? "Nouveau geste", family: g.family ?? "semelle", ...toColumns(g) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function updateGesture(id: string, g: GestureInput): Promise<void> {
  const { error } = await db().from("method_gestures").update(toColumns(g)).eq("id", id).eq("club_id", CLUB_ID);
  if (error) throw new Error(error.message);
}
