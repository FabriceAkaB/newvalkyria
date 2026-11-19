/** Progression en vidéo (JP, 19 nov. 2026) : chaque fille est filmée (ball mastery, gestes de la saison) à quelques
 *  moments de la saison, pour que la famille voie sa progression et qu'on montre un avant / après à la fin.
 *  Les petites (nées en 2016 et après) : début, milieu et fin de saison. Les grandes (2015 et avant) : milieu et fin.
 *  Règles pures. Vidéos d'enfants : stockage privé, vues seulement par la famille de la joueuse (Loi 25). */

export const CHECKPOINTS = [
  { key: "debut", label: "Début de saison" },
  { key: "mi", label: "Mi-saison" },
  { key: "fin", label: "Fin de saison" }
] as const;
export type Checkpoint = (typeof CHECKPOINTS)[number]["key"];
export const isCheckpoint = (v: unknown): v is Checkpoint => CHECKPOINTS.some((c) => c.key === v);
export const checkpointLabel = (k: string) => CHECKPOINTS.find((c) => c.key === k)?.label ?? k;

/** Les années de naissance d'une catégorie (« 2016 », « 2014-2013 », « 2016-2017 »). */
const yearsOf = (category: string | null | undefined) => (String(category ?? "").match(/20\d\d/g) ?? []).map(Number);

/** Les petites ont trois moments ; les 2015 et plus vieilles, deux (mi-saison et fin). */
export function checkpointsFor(category: string | null | undefined): Checkpoint[] {
  const years = yearsOf(category);
  const youngest = years.length ? Math.max(...years) : 2016;
  return youngest >= 2016 ? ["debut", "mi", "fin"] : ["mi", "fin"];
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Quand filmer chaque moment : début = les 6 premières semaines ; mi-saison = autour du bulletin du 15 décembre ;
 *  fin = les 3 dernières semaines de la saison. */
export function checkpointWindow(season: { starts_on: string; ends_on: string }, cp: Checkpoint): { from: string; to: string } {
  const start = season.starts_on.slice(0, 10);
  const end = season.ends_on.slice(0, 10);
  if (cp === "debut") return { from: start, to: addDays(start, 42) };
  if (cp === "fin") return { from: addDays(end, -21), to: end };
  const year = Number(start.slice(0, 4));
  return { from: `${year}-12-01`, to: `${year}-12-20` };
}

/** Le moment à filmer en ce moment (ou le prochain), pour l'écran de l'admin. */
export function currentCheckpoint(season: { starts_on: string; ends_on: string }, today: string): Checkpoint {
  for (const c of CHECKPOINTS.map((x) => x.key)) if (today <= checkpointWindow(season, c).to) return c;
  return "fin";
}

/** Avant / après : la vidéo du premier moment filmé et celle du dernier, s'il y en a au moins deux différents. */
export function beforeAfter<T extends { checkpoint: string; createdAt: string }>(videos: T[]): { before: T; after: T } | null {
  const order = (k: string) => CHECKPOINTS.findIndex((c) => c.key === k);
  const sorted = [...videos].sort((a, b) => order(a.checkpoint) - order(b.checkpoint) || a.createdAt.localeCompare(b.createdAt));
  if (!sorted.length) return null;
  const before = sorted[0];
  const after = [...sorted].reverse().find((v) => v.checkpoint !== before.checkpoint);
  return after ? { before, after } : null;
}
