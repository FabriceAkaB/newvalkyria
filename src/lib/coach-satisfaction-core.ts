/** Satisfaction des parents envers chaque éducatrice (JP, 17 nov. 2026 ; plan des deux espaces, phase 3) : une
 *  question des sondages (rôle « educatrice ») ; la note d'une famille va aux éducatrices qui ont coaché sa fille
 *  (au moins 2 pratiques de sa catégorie dans les 45 jours avant la réponse). Le mot libre est montré à l'éducatrice
 *  sans le nom de la famille. Règles pures, testées. */

export const WINDOW_DAYS = 45;
export const MIN_SESSIONS = 2;

export interface ScoredResponse {
  respondedAt: string;
  categories: string[];
  score: number | null;
  comment: string | null;
}
export interface CoachSession {
  coachId: string;
  category: string;
  date: string;
}
export interface CoachSatisfaction {
  coachId: string;
  count: number;
  average: number | null;
  comments: string[];
}

const daysBetween = (a: string, b: string) => (Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 86_400_000;

export function attributeScores(responses: ScoredResponse[], sessions: CoachSession[]): Map<string, CoachSatisfaction> {
  const out = new Map<string, CoachSatisfaction>();
  for (const r of responses) {
    const counts = new Map<string, number>();
    for (const s of sessions) {
      const gap = daysBetween(s.date, r.respondedAt);
      if (r.categories.includes(s.category) && gap >= 0 && gap <= WINDOW_DAYS) counts.set(s.coachId, (counts.get(s.coachId) ?? 0) + 1);
    }
    for (const [coachId, n] of counts) {
      if (n < MIN_SESSIONS) continue;
      const cur = out.get(coachId) ?? { coachId, count: 0, average: null, comments: [] };
      if (typeof r.score === "number") {
        const total = (cur.average ?? 0) * cur.count + r.score;
        cur.count += 1;
        cur.average = Math.round((total / cur.count) * 10) / 10;
      }
      if (r.comment?.trim()) cur.comments.push(r.comment.trim());
      out.set(coachId, cur);
    }
  }
  return out;
}
