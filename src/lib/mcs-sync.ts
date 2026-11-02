import { CLUB_ID } from "@/lib/club";
import { getAllEventsForExport, getAllMembersForExport } from "@/lib/monclubsportif-export";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Liste « à faire dans MonClubSportif » (AU19, tâche P8.4.06) : à partir des mêmes fichiers que les
 *  exports, on ne garde que les nouveautés depuis la dernière importation (nouvelles inscrites,
 *  nouvelles activités à venir) et les joueuses déjà importées qui ne sont plus inscrites (à retirer).
 *  JP (ou plus tard l'agent A12) importe le fichier dans MonClubSportif puis marque « importé ». */

function db() {
  return getSupabaseAdminClient() as any;
}

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const memberKey = (r: (string | null)[]) => [r[0], r[1], r[4], r[5]].map(norm).join("|");
export const memberLabel = (r: (string | null)[]) => `${r[0] ?? ""} ${r[1] ?? ""} · ${r[5] ?? r[4] ?? ""}`.trim();
export const eventKey = (r: (string | null)[]) => [r[1], r[2], r[6], r[11]].map(norm).join("|");
export const eventLabel = (r: (string | null)[]) => `${r[1] ?? ""} ${r[2] ?? ""} · ${r[11] ?? ""} (${r[6] ?? ""})`;

export interface McsStatus {
  members: (string | null)[][];
  newMembers: (string | null)[][];
  events: (string | null)[][];
  newEvents: (string | null)[][];
  toRemove: { key: string; label: string }[];
  syncedMembers: number;
  syncedEvents: number;
  lastSync: string | null;
}

export async function getMcsStatus(): Promise<McsStatus> {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const [members, allEvents, { data: synced }] = await Promise.all([
    getAllMembersForExport(),
    getAllEventsForExport(),
    db().from("mcs_sync_items").select("kind, key, label, synced_at, removed_at").eq("club_id", CLUB_ID)
  ]);
  const events = allEvents.filter((r) => String(r[1] ?? "") >= today);
  const done = (kind: string) => new Set((synced ?? []).filter((s: any) => s.kind === kind).map((s: any) => s.key));
  const m = done("membre");
  const e = done("evenement");
  const currentMemberKeys = new Set(members.map(memberKey));
  const toRemove = (synced ?? [])
    .filter((s: any) => s.kind === "membre" && !s.removed_at && !currentMemberKeys.has(s.key))
    .map((s: any) => ({ key: s.key, label: s.label ?? s.key }));
  const dates = (synced ?? []).map((s: any) => String(s.synced_at)).sort();
  return {
    members,
    newMembers: members.filter((r) => !m.has(memberKey(r))),
    events,
    newEvents: events.filter((r) => !e.has(eventKey(r))),
    toRemove,
    syncedMembers: m.size,
    syncedEvents: e.size,
    lastSync: dates.at(-1) ?? null
  };
}

/** Marque comme importés (dans MonClubSportif) les membres ou événements nouveaux d'aujourd'hui. */
export async function markImported(kind: "membre" | "evenement"): Promise<number> {
  const s = await getMcsStatus();
  const rows = kind === "membre" ? s.newMembers : s.newEvents;
  if (!rows.length) return 0;
  const items = rows.map((r) => ({ club_id: CLUB_ID, kind, key: kind === "membre" ? memberKey(r) : eventKey(r), label: kind === "membre" ? memberLabel(r) : eventLabel(r) }));
  const { error } = await db().from("mcs_sync_items").upsert(items, { onConflict: "club_id,kind,key", ignoreDuplicates: true });
  if (error) throw error;
  return items.length;
}

export async function markRemoved(key: string): Promise<void> {
  const { error } = await db().from("mcs_sync_items").update({ removed_at: new Date().toISOString() }).eq("club_id", CLUB_ID).eq("kind", "membre").eq("key", key);
  if (error) throw error;
}
