/**
 * In-memory store for club name aliases / groupings.
 * Allows admin to manually group different spellings of the same club
 * (e.g., "fc laval", "FC Laval", "F.C. Laval" → all map to "FC Laval").
 *
 * Persists across requests in the same server process.
 */

export interface ClubGroup {
  /** Canonical / display name */
  canonical: string;
  /** Lowercase aliases that should be normalized to canonical */
  aliases: string[];
}

let groups: ClubGroup[] = [];

/** Normalize a raw club name string for comparison */
function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Get the canonical name for a given raw club, or return the raw value if no match */
export function resolveClub(raw: string): string {
  if (!raw) return raw;
  const key = normalizeKey(raw);
  for (const g of groups) {
    if (normalizeKey(g.canonical) === key) return g.canonical;
    if (g.aliases.some((a) => normalizeKey(a) === key)) return g.canonical;
  }
  return raw;
}

export function getClubGroups(): ClubGroup[] {
  return groups.map((g) => ({ canonical: g.canonical, aliases: [...g.aliases] }));
}

export function setClubGroups(next: ClubGroup[]): void {
  groups = next.map((g) => ({
    canonical: g.canonical.trim(),
    aliases: g.aliases.map((a) => a.trim()).filter(Boolean),
  })).filter((g) => g.canonical);
}

export function addClubGroup(canonical: string, aliases: string[] = []): void {
  groups = [
    ...groups,
    { canonical: canonical.trim(), aliases: aliases.map((a) => a.trim()).filter(Boolean) },
  ];
}

export function removeClubGroup(canonical: string): void {
  groups = groups.filter((g) => g.canonical !== canonical);
}
