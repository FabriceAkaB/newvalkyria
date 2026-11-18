/** Bulletin de progression des joueuses (JP, 17 nov. 2026) : deux par saison, à la mi-saison et à la fin de la
 *  saison. Une évaluation globale, les présences, les 3 critères que les éducateurs notent après chaque pratique
 *  (barres de couleur 1 à 5), le bien-être et l'engagement dits par la joueuse elle-même (sondage, sur 10) et son
 *  leadership de capitaine. Règles pures, testées (bulletin-report.test.ts). */

export type BulletinPeriod = "mi-saison" | "fin-saison";

/** Dates des saisons (la mi-saison = la fin de la demi-saison). */
const SEASONS: Record<string, { start: string; mid: string; end: string; label: string }> = {
  "automne-hiver-2026": { start: "2026-09-01", mid: "2026-12-15", end: "2027-04-18", label: "Saison 2026-2027" }
};
const FALLBACK = SEASONS["automne-hiver-2026"];

export function seasonDates(seasonId: string | null | undefined) {
  return SEASONS[seasonId ?? ""] ?? FALLBACK;
}

export interface PeriodRange {
  period: BulletinPeriod;
  label: string;
  from: string;
  to: string;
  /** Bulletin pas encore à sa date : les chiffres sont provisoires. */
  provisional: boolean;
}

export function periodRange(seasonId: string | null | undefined, period: BulletinPeriod, today: string): PeriodRange {
  const s = seasonDates(seasonId);
  const to = period === "mi-saison" ? s.mid : s.end;
  return { period, label: period === "mi-saison" ? "Bulletin de mi-saison" : "Bulletin de fin de saison", from: s.start, to, provisional: today < to };
}

/** Le bulletin à montrer d'abord : celui de mi-saison jusqu'à la mi-saison, ensuite celui de fin de saison. */
export function currentPeriod(seasonId: string | null | undefined, today: string): BulletinPeriod {
  return today <= seasonDates(seasonId).mid ? "mi-saison" : "fin-saison";
}

/** L'échelle de l'évaluation rapide (1 à 5), avec ses couleurs. */
/** Échelle aux couleurs New Valkyria : du corail (à travailler) jusqu'au violet de l'académie (excellent). */
export const LEVELS = [
  { value: 1, label: "À travailler", color: "#d9534f" },
  { value: 2, label: "Fragile", color: "#e8893a" },
  { value: 3, label: "Correct", color: "#c9a227" },
  { value: 4, label: "Bien", color: "#8a5cd0" },
  { value: 5, label: "Excellent", color: "#4b1f78" }
] as const;

export function levelOf(value: number | null): (typeof LEVELS)[number] | null {
  if (value === null) return null;
  return LEVELS[Math.min(4, Math.max(0, Math.round(value) - 1))];
}

export const CRITERIA = [
  { key: "Ball mastery", label: "Ball mastery", detail: "Maîtrise du ballon des 2 pieds, tête levée" },
  { key: "Prestation", label: "Prestation", detail: "Ce qu'elle réalise en jeu : passes, duels, décisions" },
  { key: "Attitude", label: "Attitude", detail: "Écoute, effort, respect et esprit d'équipe" }
] as const;

export const WELLBEING = [
  { key: "practice_rating", label: "Plaisir général", detail: "Le plaisir qu'elle dit avoir eu aux pratiques", reverse: false },
  { key: "learning", label: "Apprentissage", detail: "A-t-elle appris quelque chose de nouveau ?", reverse: false },
  { key: "understanding", label: "Compréhension", detail: "A-t-elle compris ce qu'on devait faire ?", reverse: false },
  { key: "confidence", label: "Confiance avec le ballon", detail: "Comment elle se sent avec le ballon", reverse: false },
  { key: "fatigue", label: "Fatigue", detail: "Sa fatigue à la fin des pratiques (plus bas = plus en forme)", reverse: true }
] as const;
type WellKey = (typeof WELLBEING)[number]["key"];

export interface EvalRow {
  date: string;
  coachId: string | null;
  ratings: Record<string, number>;
}
export interface AttendanceRow {
  date: string;
  status: string;
  practice_rating?: number | null;
  fatigue?: number | null;
  learning?: number | null;
  understanding?: number | null;
  confidence?: number | null;
}
export interface CaptainRow {
  date: string;
  leadership: number | null;
}

const avg = (vals: number[]) => (vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null);
const inRange = (d: string, from: string, to: string) => d >= from && d <= to;
const HERE = ["present", "late", "left_early"];

export interface BulletinSummary {
  global: number | null;
  attendance: { present: number; total: number; rate: number | null };
  criteria: { key: string; label: string; detail: string; value: number | null; count: number; before: number | null }[];
  wellbeing: { key: WellKey; label: string; detail: string; reverse: boolean; value: number | null; count: number }[];
  leadership: { times: number; value: number | null };
  coaches: number;
  practices: number;
}

/** Le bulletin d'une période. `before` (fin de saison) : la valeur à la mi-saison, pour montrer la progression. */
export function summarize(input: { evaluations: EvalRow[]; attendance: AttendanceRow[]; captaincies: CaptainRow[]; from: string; to: string; mid?: string | null }): BulletinSummary {
  const evals = input.evaluations.filter((e) => inRange(e.date, input.from, input.to));
  const att = input.attendance.filter((a) => inRange(a.date, input.from, input.to));
  const caps = input.captaincies.filter((c) => inRange(c.date, input.from, input.to));
  const crit = (key: string, list: EvalRow[]) => list.map((e) => Number(e.ratings?.[key])).filter((v) => v >= 1 && v <= 5);
  const criteria = CRITERIA.map((c) => {
    const vals = crit(c.key, evals);
    const before = input.mid ? avg(crit(c.key, evals.filter((e) => e.date <= input.mid!))) : null;
    return { key: c.key, label: c.label, detail: c.detail, value: avg(vals), count: vals.length, before: input.mid && evals.some((e) => e.date > input.mid!) ? before : null };
  });
  const present = att.filter((a) => HERE.includes(a.status)).length;
  const wellbeing = WELLBEING.map((w) => {
    const vals = att.map((a) => a[w.key]).filter((v): v is number => typeof v === "number" && v >= 1 && v <= 10);
    return { key: w.key, label: w.label, detail: w.detail, reverse: w.reverse, value: avg(vals), count: vals.length };
  });
  const leads = caps.map((c) => c.leadership).filter((v): v is number => typeof v === "number");
  const scored = criteria.map((c) => c.value).filter((v): v is number => v !== null);
  return {
    global: avg(scored),
    attendance: { present, total: att.length, rate: att.length ? Math.round((present / att.length) * 100) : null },
    criteria,
    wellbeing,
    leadership: { times: caps.length, value: avg(leads) },
    coaches: new Set(evals.map((e) => e.coachId).filter(Boolean)).size,
    practices: new Set(evals.map((e) => e.date)).size
  };
}

/* ── Bulletin remis ou pas encore, et mot des éducateurs pour la famille (JP, 17 nov. 2026) ── */

/** Le bulletin est remis à la famille à la date de fin de sa période (mi-saison, fin de saison) ; avant, la famille
 *  le voit flou avec « Bientôt disponible ». L'équipe le voit toujours. */
export function isReleased(range: PeriodRange, audience: "equipe" | "parent"): boolean {
  return audience === "equipe" || !range.provisional;
}

export const FAMILY_COMMENT_MIN = 40;
export const FAMILY_COMMENT_MAX = 1200;

/** Un mot pour la famille : assez long pour être utile, jamais une note interne copiée. Renvoie le problème, ou null. */
export function checkFamilyComment(text: string, firstName: string): string | null {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length < FAMILY_COMMENT_MIN) return `Écris au moins ${FAMILY_COMMENT_MIN} caractères : une force de ${firstName}, puis un point à travailler et comment.`;
  if (t.length > FAMILY_COMMENT_MAX) return `${FAMILY_COMMENT_MAX} caractères au plus : garde l'essentiel.`;
  return null;
}
