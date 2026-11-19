/** Notes par geste du ball mastery (JP, 18 nov. 2026) : 1 = incapable de faire le geste, 10 = maîtrise parfaite.
 *  Un geste noté 4 ou moins est « à retravailler » (gestes difficiles, Valkyria Lab). Règles pures. */

export const GESTURE_MIN = 1;
export const GESTURE_MAX = 10;
export const DIFFICULT_MAX = 4;

export function cleanGestureScores(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 12)) {
    const name = String(k).trim().slice(0, 60);
    const n = Number(v);
    if (name && Number.isInteger(n) && n >= GESTURE_MIN && n <= GESTURE_MAX) out[name] = n;
  }
  return out;
}

export const difficultGestures = (scores: Record<string, number>) => Object.entries(scores).filter(([, v]) => v <= DIFFICULT_MAX).map(([k]) => k);

/** Répartition des filles à observer entre les éducateurs présents : toujours la même pour tous (tri par nom et par
 *  identifiant), une fille sur n à chacun. */
export function observerOf(playerIds: string[], coachIds: string[]): Map<string, string> {
  const coaches = [...coachIds].sort();
  const out = new Map<string, string>();
  if (!coaches.length) return out;
  playerIds.forEach((p, i) => out.set(p, coaches[i % coaches.length]));
  return out;
}
