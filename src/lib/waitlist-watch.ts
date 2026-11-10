import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Une fille de la liste d'attente vient de payer son inscription : JP doit le savoir (demande de JP, 9 nov. 2026).
 *  Appelé par le webhook Stripe pour chaque inscription payée (saison, essai converti, offre, programmes, Sport-Études).
 *  Les listes d'attente vivent dans `registrations` (saison filles) et `session_program_registrations` (programmes),
 *  avec le statut « waitlist ». */

const norm = (v: string | null | undefined) =>
  (v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export interface PlayerRef {
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  parentEmail: string | null | undefined;
}

/** Même joueuse : même prénom et même nom (accents, majuscules, traits d'union et espaces ignorés), ou même prénom
 *  avec le même courriel parent (le nom de famille a pu être écrit autrement). Un courriel seul ne suffit pas : une sœur. */
export function sameWaitlistPlayer(a: PlayerRef, b: PlayerRef): boolean {
  const fa = norm(a.firstName);
  const fb = norm(b.firstName);
  if (!fa || !fb) return false;
  const firstMatch = fa === fb || fa.split(" ")[0] === fb.split(" ")[0];
  if (!firstMatch) return false;
  const la = norm(a.lastName).replace(/ /g, "");
  const lb = norm(b.lastName).replace(/ /g, "");
  if (la && lb && (la === lb || la.startsWith(lb) || lb.startsWith(la))) return true;
  const ea = (a.parentEmail ?? "").trim().toLowerCase();
  return Boolean(ea) && ea === (b.parentEmail ?? "").trim().toLowerCase();
}

export interface WaitlistEntry {
  id: string;
  table: "registrations" | "session_program_registrations";
  program: string;
  since: string;
}

/** Les inscriptions « liste d'attente » de cette joueuse (sauf la ligne payée elle-même). */
export async function findWaitlistEntries(player: PlayerRef & { excludeId?: string | null }): Promise<WaitlistEntry[]> {
  if (!norm(player.firstName)) return [];
  const db = getSupabaseAdminClient() as any;
  const [{ data: season }, { data: programs }] = await Promise.all([
    db.from("registrations").select("id, player_first_name, player_last_name, parent_email, program_id, category_id, created_at").eq("status", "waitlist"),
    db.from("session_program_registrations").select("id, player_first_name, player_last_name, parent_email, program_slug, created_at").eq("status", "waitlist")
  ]);
  const out: WaitlistEntry[] = [];
  for (const r of (season ?? []) as any[]) {
    if (r.id === player.excludeId) continue;
    if (sameWaitlistPlayer(player, { firstName: r.player_first_name, lastName: r.player_last_name, parentEmail: r.parent_email }))
      out.push({ id: r.id, table: "registrations", program: [r.program_id, r.category_id].filter(Boolean).join(" "), since: String(r.created_at).slice(0, 10) });
  }
  for (const r of (programs ?? []) as any[]) {
    if (r.id === player.excludeId) continue;
    if (sameWaitlistPlayer(player, { firstName: r.player_first_name, lastName: r.player_last_name, parentEmail: r.parent_email }))
      out.push({ id: r.id, table: "session_program_registrations", program: String(r.program_slug ?? ""), since: String(r.created_at).slice(0, 10) });
  }
  return out;
}

/** Phrase pour l'avis à JP (null si elle n'était pas sur une liste d'attente). */
export function waitlistNote(entries: WaitlistEntry[]): string | null {
  if (!entries.length) return null;
  const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
  return `Elle était sur la liste d'attente : ${entries.map((e) => `${e.program || "programme"} (depuis le ${day(e.since)})`).join(", ")}. Pense à la retirer de la liste d'attente dans l'admin.`;
}
