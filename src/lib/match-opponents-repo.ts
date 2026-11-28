import { randomBytes } from "node:crypto";

import { awayMatches, groupOpponents, type McsGame, type Opponent } from "@/lib/match-opponents";
import { orgKey } from "@/lib/match-slots-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Adversaires et matchs à l'extérieur (JP, 27 nov. 2026). Règles : match-opponents.ts. */

function db() {
  return getSupabaseAdminClient() as any;
}

const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

export async function getOpponents(): Promise<Opponent[]> {
  const [{ data: teams, error }, { data: bookings }] = await Promise.all([
    db().from("match_team_profiles").select("*").order("created_at"),
    db().from("match_slot_bookings").select("org_key, org_name, status, price_cents, balance_due_cents, balance_paid_at, slot:match_slots(slot_date)")
  ]);
  if (error) throw new Error(error.message);
  return groupOpponents(
    (teams ?? []) as any[],
    ((bookings ?? []) as any[]).map((b) => ({ ...b, slot_date: b.slot?.slot_date ?? null })),
    todayIso()
  );
}

export interface ManualTeamInput {
  orgName: string;
  teamLabel: string;
  gender: "filles" | "garcons" | "mixte" | null;
  /** Null : club ajouté sans catégorie connue (« à préciser »). */
  birthYear: number | null;
  birthYearTo: number | null;
  level: string;
  players: number | null;
  count: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string | null;
}

/** Ajoute à la main une équipe d'un club (nouveau ou existant) : sa catégorie et combien d'équipes de cette catégorie. */
export async function addManualTeam(input: ManualTeamInput): Promise<void> {
  const key = orgKey(input.orgName);
  if (!key) throw new Error("Nom du club invalide.");
  // Le contact du club, s'il n'est pas donné : celui déjà connu.
  const { data: known } = await db().from("match_team_profiles").select("contact_name, contact_email, contact_phone, logo_url").eq("org_key", key).order("created_at").limit(1);
  const k = (known ?? [])[0] ?? {};
  const { error } = await db()
    .from("match_team_profiles")
    .insert({
      org_name: input.orgName.trim(),
      org_key: key,
      team_label: input.teamLabel.trim() || (input.birthYear ? `${input.gender === "garcons" ? "G" : "F"}${input.birthYear}` : "Équipes à préciser"),
      team_gender: input.gender,
      team_birth_year: input.birthYear,
      team_birth_year_to: input.birthYear ? input.birthYearTo ?? input.birthYear : null,
      team_level: input.level.trim() || "À préciser",
      team_players: input.players,
      team_count: Math.max(1, Math.min(20, Math.round(input.count) || 1)),
      contact_name: input.contactName.trim() || k.contact_name || "",
      contact_email: input.contactEmail.trim() || k.contact_email || "",
      contact_phone: input.contactPhone.trim() || k.contact_phone || "",
      notes: input.notes?.trim() || null,
      logo_url: k.logo_url ?? null,
      source: "manuel",
      access_token: randomBytes(24).toString("hex")
    });
  if (error) throw new Error(error.message);
}

/** Change le nombre d'équipes d'une catégorie, ses joueurs ou son calibre. */
export async function updateTeam(id: string, patch: { count?: number; players?: number | null; level?: string; notes?: string | null }): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.count !== undefined) row.team_count = Math.max(1, Math.min(20, Math.round(patch.count) || 1));
  if (patch.players !== undefined) row.team_players = patch.players;
  if (patch.level !== undefined) row.team_level = patch.level.trim() || "À préciser";
  if (patch.notes !== undefined) row.notes = patch.notes?.trim() || null;
  const { error } = await db().from("match_team_profiles").update(row).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Retire une équipe ajoutée à la main (jamais une équipe qui a rempli le formulaire ou réservé). */
export async function removeManualTeam(id: string): Promise<void> {
  const { data: t } = await db().from("match_team_profiles").select("source").eq("id", id).maybeSingle();
  if (!t) throw new Error("Équipe introuvable.");
  if (t.source !== "manuel") throw new Error("Cette équipe a rempli le formulaire : archivez le club plutôt.");
  const { data: used } = await db().from("match_slot_bookings").select("id").eq("team_profile_id", id).limit(1);
  if ((used ?? []).length) throw new Error("Cette équipe a déjà réservé : archivez le club plutôt.");
  const { error } = await db().from("match_team_profiles").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Archive (ou ressort des archives) toutes les équipes d'un club. */
export async function setOpponentArchived(key: string, archived: boolean): Promise<void> {
  const { error } = await db().from("match_team_profiles").update({ archived_at: archived ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("org_key", key);
  if (error) throw new Error(error.message);
}

/** Les matchs de nos équipes dans MonClubSportif qui ne sont sur aucune plage du site (à l'extérieur, ou ajoutés
 *  directement dans MonClubSportif), à venir. */
export async function getAwayMatches(): Promise<McsGame[]> {
  const today = todayIso();
  const [{ data: events }, { data: teams }, { data: slots }] = await Promise.all([
    db().from("mcs_events").select("team_id, event_date, start_time, end_time, title, location, type").gte("event_date", today).in("type", ["Match", "Tournoi"]),
    db().from("mcs_teams").select("id, name"),
    db().from("match_slots").select("slot_date, start_time").gte("slot_date", today)
  ]);
  const name = new Map(((teams ?? []) as any[]).map((t) => [t.id, t.name as string]));
  // « Vendredi Solo » est l'horaire personnel de JP (futsal à St-Gabriel, FC Elevate) : pas des matchs de l'académie.
  const personal = new Set(((teams ?? []) as any[]).filter((t) => /solo/i.test(String(t.name))).map((t) => t.id));
  const games: McsGame[] = ((events ?? []) as any[]).filter((e) => !personal.has(e.team_id)).map((e) => ({ date: String(e.event_date).slice(0, 10), start: e.start_time ?? null, end: e.end_time ?? null, team: name.get(e.team_id) ?? "", title: String(e.title ?? ""), location: e.location ?? null, type: e.type ?? null }));
  // Un même match peut être dans deux calendriers (ex. JP assigné partout) : une ligne par équipe, jour et heure.
  const seen = new Set<string>();
  return awayMatches(games, (slots ?? []) as any[], today).filter((g) => {
    const k = `${g.team}|${g.date}|${g.start}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
