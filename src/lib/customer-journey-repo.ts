import { CLUB_ID } from "@/lib/club";
import { JOURNEY_SEED, type JourneyNode, type NodeKind, type SeedNode } from "@/lib/customer-journey-core";
import type { ItemStatus } from "@/lib/parcours-valkyria";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Parcours client : table customer_journey_nodes. La première ouverture range le gabarit (JOURNEY_SEED). */

const db = () => getSupabaseAdminClient() as any;
const COLS = "id, parent_id, sort_order, kind, title, detail, status, where_ref";

async function seed(nodes: SeedNode[], parentId: string | null): Promise<void> {
  for (const [i, n] of nodes.entries()) {
    const { data, error } = await db()
      .from("customer_journey_nodes")
      .insert({ club_id: CLUB_ID, parent_id: parentId, sort_order: i * 10, kind: n.kind, title: n.title, detail: n.detail ?? null, status: n.status ?? "en-place", where_ref: n.where ?? null })
      .select("id")
      .single();
    if (error) throw error;
    if (n.children?.length) await seed(n.children, data.id);
  }
}

export async function getJourney(): Promise<JourneyNode[]> {
  const { data, error } = await db().from("customer_journey_nodes").select(COLS).eq("club_id", CLUB_ID);
  if (error) throw error;
  if ((data ?? []).length) return data as JourneyNode[];
  await seed(JOURNEY_SEED, null);
  const { data: again, error: e2 } = await db().from("customer_journey_nodes").select(COLS).eq("club_id", CLUB_ID);
  if (e2) throw e2;
  return (again ?? []) as JourneyNode[];
}

export interface NodeInput {
  kind: NodeKind;
  title: string;
  detail?: string | null;
  status: ItemStatus;
  whereRef?: string | null;
}

const clean = (v: string | null | undefined) => (v ?? "").trim() || null;

export async function addNode(parentId: string | null, input: NodeInput): Promise<void> {
  const q = db().from("customer_journey_nodes").select("sort_order").eq("club_id", CLUB_ID).order("sort_order", { ascending: false }).limit(1);
  const { data: last } = parentId ? await q.eq("parent_id", parentId) : await q.is("parent_id", null);
  const { error } = await db()
    .from("customer_journey_nodes")
    .insert({ club_id: CLUB_ID, parent_id: parentId, sort_order: (last?.[0]?.sort_order ?? 0) + 10, kind: input.kind, title: input.title.trim(), detail: clean(input.detail), status: input.status, where_ref: clean(input.whereRef) });
  if (error) throw error;
}

export async function updateNode(id: string, input: NodeInput): Promise<void> {
  const { error } = await db()
    .from("customer_journey_nodes")
    .update({ kind: input.kind, title: input.title.trim(), detail: clean(input.detail), status: input.status, where_ref: clean(input.whereRef), updated_at: new Date().toISOString() })
    .eq("club_id", CLUB_ID)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteNode(id: string): Promise<void> {
  const { error } = await db().from("customer_journey_nodes").delete().eq("club_id", CLUB_ID).eq("id", id);
  if (error) throw error;
}

/** Monte ou descend un nœud parmi ses frères. */
export async function moveNode(id: string, dir: -1 | 1): Promise<void> {
  const { data: me } = await db().from("customer_journey_nodes").select("id, parent_id, sort_order").eq("id", id).single();
  if (!me) return;
  const q = db().from("customer_journey_nodes").select("id, sort_order").eq("club_id", CLUB_ID);
  const { data: sibs } = me.parent_id ? await q.eq("parent_id", me.parent_id) : await q.is("parent_id", null);
  const list = ((sibs ?? []) as { id: string; sort_order: number }[]).sort((a, b) => a.sort_order - b.sort_order);
  const i = list.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  for (const [k, s] of list.entries()) await db().from("customer_journey_nodes").update({ sort_order: k * 10 }).eq("id", s.id);
}
