import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export interface PlayerSearchResult {
  playerId: string;
  firstName: string;
  lastName: string;
  dob: string | null;
  registrations: { id: string; seasonId: string; status: string; parentName: string; parentEmail: string }[];
  leadCount: number;
}

export interface CoachSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  status: string;
}

export interface GlobalSearchResults {
  players: PlayerSearchResult[];
  coaches: CoachSearchResult[];
}

/** Recherche transversale (section 35 de l'audit) — s'appuie sur l'entité
 *  joueuse canonique (players) pour retrouver en une fois toutes les
 *  inscriptions d'une même joueuse, toutes saisons confondues. */
export async function globalSearch(query: string): Promise<GlobalSearchResults> {
  const q = query.trim();
  if (q.length < 2) return { players: [], coaches: [] };

  const supabase = db();

  const { data: playerRows, error: playerErr } = await supabase
    .from("players")
    .select("id, first_name, last_name, dob")
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
    .limit(15);
  if (playerErr) throw new Error(playerErr.message);

  const playerIds = (playerRows ?? []).map((p: any) => p.id);
  const [{ data: regRows, error: regErr }, { data: leadRows, error: leadErr }] = await Promise.all([
    playerIds.length > 0
      ? supabase.from("registrations").select("id, player_id, season_id, status, parent_name, parent_email").in("player_id", playerIds)
      : Promise.resolve({ data: [], error: null }),
    playerIds.length > 0 ? supabase.from("leads").select("id, player_id").in("player_id", playerIds) : Promise.resolve({ data: [], error: null })
  ]);
  if (regErr) throw new Error(regErr.message);
  if (leadErr) throw new Error(leadErr.message);

  const players: PlayerSearchResult[] = (playerRows ?? []).map((p: any) => ({
    playerId: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    dob: p.dob,
    registrations: (regRows ?? [])
      .filter((r: any) => r.player_id === p.id)
      .map((r: any) => ({ id: r.id, seasonId: r.season_id, status: r.status, parentName: r.parent_name, parentEmail: r.parent_email })),
    leadCount: (leadRows ?? []).filter((l: any) => l.player_id === p.id).length
  }));

  const { data: coachRows, error: coachErr } = await supabase
    .from("coaches")
    .select("id, first_name, last_name, email, status")
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
    .limit(10);
  if (coachErr) throw new Error(coachErr.message);

  const coaches: CoachSearchResult[] = (coachRows ?? []).map((c: any) => ({ id: c.id, firstName: c.first_name, lastName: c.last_name, email: c.email, status: c.status }));

  return { players, coaches };
}
