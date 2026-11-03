/** Bilan de la semaine de JP (demande du 3 nov. 2026) : chaque semaine, 3 questions sur la semaine qui finit.
 *  1. Qu'est-ce qui a bien marché ? 2. Qu'est-ce que j'aurais dû faire différemment ? 3. Quelle est la priorité n° 1
 *  de la semaine prochaine ? Règles pures (dates), partagées par la page, « Aujourd'hui » et le courriel du lundi. */

export const REVIEW_QUESTIONS = [
  { key: "wentWell", label: "Qu'est-ce qui a bien marché ?" },
  { key: "doDifferently", label: "Qu'est-ce que j'aurais dû faire différemment ?" },
  { key: "nextPriority", label: "Quelle est la priorité n° 1 de la semaine qui vient ?" }
] as const;
export type ReviewKey = (typeof REVIEW_QUESTIONS)[number]["key"];

export interface WeeklyReview {
  weekStart: string;
  wentWell: string | null;
  doDifferently: string | null;
  nextPriority: string | null;
  answeredAt: string | null;
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Lundi de la semaine d'une date (AAAA-MM-JJ). */
export function mondayOf(iso: string): string {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}

/** La semaine dont le bilan est à faire aujourd'hui : du vendredi au dimanche, la semaine qui finit (on peut le faire
 *  d'avance) ; du lundi au jeudi, la semaine passée (en retard s'il n'est pas fait). */
export function reviewWeekFor(today: string): { weekStart: string; late: boolean } {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
  const thisMonday = mondayOf(today);
  if (dow === 0 || dow >= 5) return { weekStart: thisMonday, late: false };
  return { weekStart: addDays(thisMonday, -7), late: true };
}

/** La semaine dont la réponse n° 3 (« priorité n° 1 ») donne la priorité de la semaine en cours. */
export const previousWeek = (today: string) => addDays(mondayOf(today), -7);

export const isComplete = (r: Pick<WeeklyReview, ReviewKey> | null | undefined) => REVIEW_QUESTIONS.every((q) => Boolean(r?.[q.key]?.trim()));

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export function weekLabel(weekStart: string): string {
  const a = new Date(`${weekStart}T12:00:00Z`);
  const b = new Date(`${addDays(weekStart, 6)}T12:00:00Z`);
  const d = (x: Date) => (x.getUTCDate() === 1 ? "1er" : String(x.getUTCDate()));
  return a.getUTCMonth() === b.getUTCMonth() ? `du ${d(a)} au ${d(b)} ${MONTHS[b.getUTCMonth()]}` : `du ${d(a)} ${MONTHS[a.getUTCMonth()]} au ${d(b)} ${MONTHS[b.getUTCMonth()]}`;
}

/** Nettoie les réponses envoyées par le formulaire. */
export function parseReview(body: Record<string, unknown>): { weekStart: string; answers: Record<ReviewKey, string | null> } | string {
  const weekStart = String(body.weekStart ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || mondayOf(weekStart) !== weekStart) return "Semaine invalide.";
  const clean = (v: unknown) => String(v ?? "").trim().slice(0, 3000) || null;
  return { weekStart, answers: { wentWell: clean(body.wentWell), doDifferently: clean(body.doDifferently), nextPriority: clean(body.nextPriority) } };
}
