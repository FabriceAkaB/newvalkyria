/**
 * Club name aliases / groupings — persisted in Supabase (table `club_groups`).
 * Allows admin to manually group different spellings of the same club
 * (e.g., "fc laval", "FC Laval", "F.C. Laval" → all map to "FC Laval").
 */

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export interface ClubGroup {
  /** Canonical / display name */
  canonical: string;
  /** Lowercase aliases that should be normalized to canonical */
  aliases: string[];
}

function isSupabaseAvailable(): boolean {
  try { getSupabaseAdminClient(); return true; } catch { return false; }
}

function rowToGroup(row: Record<string, unknown>): ClubGroup {
  return { canonical: row.canonical as string, aliases: (row.aliases as string[]) ?? [] };
}

// Repli en mémoire uniquement si Supabase est indisponible (perdu au redémarrage).
let memCache: ClubGroup[] = [];

/** Normalize a raw club name string for comparison */
function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function getClubGroups(): Promise<ClubGroup[]> {
  if (isSupabaseAvailable()) {
    const { data, error } = await db()
      .from("club_groups")
      .select("*")
      .order("canonical");
    if (!error && data) {
      const groups = (data as Record<string, unknown>[]).map(rowToGroup);
      memCache = groups;
      return groups.map((g) => ({ ...g }));
    }
  }
  return memCache.map((g) => ({ ...g }));
}

export async function setClubGroups(next: ClubGroup[]): Promise<void> {
  const cleaned = next
    .map((g) => ({ canonical: g.canonical.trim(), aliases: g.aliases.map((a) => a.trim()).filter(Boolean) }))
    .filter((g) => g.canonical);
  memCache = cleaned;

  if (isSupabaseAvailable()) {
    const supabase = db();
    // Remplace l'ensemble des groupes (petite liste gérée entièrement depuis l'admin).
    const { error: delErr } = await supabase.from("club_groups").delete().neq("canonical", "");
    if (delErr) throw new Error(delErr.message);
    if (cleaned.length > 0) {
      const { error: insErr } = await supabase.from("club_groups").insert(
        cleaned.map((g) => ({ canonical: g.canonical, aliases: g.aliases, updated_at: new Date().toISOString() }))
      );
      if (insErr) throw new Error(insErr.message);
    }
  }
}

/** Get the canonical name for a given raw club, or return the raw value if no match */
export async function resolveClub(raw: string): Promise<string> {
  if (!raw) return raw;
  const key = normalizeKey(raw);
  const groups = await getClubGroups();
  for (const g of groups) {
    if (normalizeKey(g.canonical) === key) return g.canonical;
    if (g.aliases.some((a) => normalizeKey(a) === key)) return g.canonical;
  }
  return raw;
}
