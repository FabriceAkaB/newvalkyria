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

export const photoKey = (first: unknown, last: unknown) => [first, last].map(norm).join("|");
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
  /** Joueuses inscrites dont on a la photo et qui ne l'ont pas encore dans MonClubSportif (la bonne photo au bon jeune). */
  photosToSend: { key: string; label: string; photoUrl: string }[];
  syncedMembers: number;
  syncedEvents: number;
  lastSync: string | null;
}

export async function getMcsStatus(): Promise<McsStatus> {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const [members, allEvents, { data: synced }, { data: photos }] = await Promise.all([
    getAllMembersForExport(),
    getAllEventsForExport(),
    db().from("mcs_sync_items").select("kind, key, label, synced_at, removed_at").eq("club_id", CLUB_ID),
    db().from("players").select("first_name, last_name, photo_url").not("photo_url", "is", null)
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
  // Seulement les joueuses encore inscrites (même prénom et nom qu'un membre de la liste MonClubSportif).
  const inscribed = new Set(members.map((r) => photoKey(r[0], r[1])));
  const sentPhotos = done("photo");
  const photosToSend = ((photos ?? []) as any[])
    .map((p) => ({ key: photoKey(p.first_name, p.last_name), label: `${p.first_name ?? ""} ${p.last_name ?? ""}`.replace(/\s+/g, " ").trim(), photoUrl: p.photo_url as string }))
    .filter((p, i, a) => inscribed.has(p.key) && !sentPhotos.has(p.key) && a.findIndex((x) => x.key === p.key) === i)
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  return {
    members,
    newMembers: members.filter((r) => !m.has(memberKey(r))),
    events,
    newEvents: events.filter((r) => !e.has(eventKey(r))),
    toRemove,
    photosToSend,
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

/** La photo de cette joueuse est maintenant dans son profil MonClubSportif. */
export async function markPhotoSent(key: string, label: string): Promise<void> {
  const { error } = await db().from("mcs_sync_items").upsert({ club_id: CLUB_ID, kind: "photo", key, label }, { onConflict: "club_id,kind,key", ignoreDuplicates: true });
  if (error) throw error;
}
