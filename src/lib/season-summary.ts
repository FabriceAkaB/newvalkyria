/** Résumé de saison d'une joueuse (Mandalart P1.2.10, JP 19 nov. 2026) : tiré de ses évaluations rapides (3 échelles
 *  de 1 à 5), des notes de gestes du ball mastery (1 à 10), de ses présences et de ses objectifs. La joueuse est
 *  toujours comparée à elle-même (début de saison → maintenant), jamais aux autres : aucune moyenne de groupe ici.
 *  Règles pures, testées (season-summary.test.ts). Réutilisable par le bulletin (bulletin-repo.ts). */

import { CRITERIA } from "@/lib/bulletin-report";

export interface SummaryEval {
  date: string;
  coachId: string | null;
  ratings: Record<string, number> | null;
  gestureScores?: Record<string, number> | null;
  /** Gestes qu'elle trouve difficiles, notés ce jour-là. */
  gestures?: string[] | null;
  comment?: string | null;
}
export interface SummaryAttendance {
  date: string;
  status: string;
}
export interface SummaryObjective {
  text: string;
  active: boolean;
}

export type Trend = "hausse" | "stable" | "baisse";

export interface ScaleProgress {
  key: string;
  label: string;
  detail: string;
  /** Moyenne de ses premières pratiques notées et de ses dernières (sur 5). */
  start: number | null;
  now: number | null;
  delta: number | null;
  trend: Trend | null;
  /** Nombre de pratiques où l'échelle a été notée. */
  count: number;
}

export interface GestureProgress {
  name: string;
  /** Début de période → maintenant (sur 10), comme les échelles. */
  first: number | null;
  recent: number | null;
  delta: number | null;
  count: number;
  /** Fois où le geste a été noté « difficile » dans ses 5 dernières pratiques évaluées. */
  difficult: number;
}

export interface AttendanceSummary {
  present: number;
  total: number;
  rate: number | null;
  /** Sur ses 6 dernières pratiques. */
  recentRate: number | null;
  /** Présences de suite, jusqu'à la dernière pratique. */
  streak: number;
  label: string | null;
}

export interface SeasonSummary {
  from: string;
  to: string;
  practicesEvaluated: number;
  scales: ScaleProgress[];
  gestures: { strong: GestureProgress[]; toWork: GestureProgress[]; improved: GestureProgress | null };
  attendance: AttendanceSummary;
  /** Jusqu'à 3 phrases tirées des observations écrites des éducateurs (début, milieu, fin de la période). */
  observations: { date: string; text: string }[];
  objectives: { active: string[]; closed: number };
  /** Une phrase factuelle sur sa plus belle progression, ou null s'il n'y a pas encore assez de données. */
  headline: string | null;
}

const HERE = ["present", "late", "left_early"];
const COUNTED = [...HERE, "absent", "injured"];
const round1 = (v: number) => Math.round(v * 10) / 10;
const avg = (vals: number[]) => (vals.length ? round1(vals.reduce((a, b) => a + b, 0) / vals.length) : null);
export const fmt = (v: number | null) => (v === null ? "—" : v.toLocaleString("fr-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Moyenne par jour : deux éducateurs qui notent la même pratique ne comptent que pour une pratique. */
function byDay(evals: SummaryEval[], pick: (e: SummaryEval) => Record<string, number> | null | undefined, ok: (v: number) => boolean): Map<string, { date: string; value: number }[]> {
  const sums = new Map<string, Map<string, number[]>>();
  for (const e of evals) {
    for (const [k, raw] of Object.entries(pick(e) ?? {})) {
      const v = Number(raw);
      if (!ok(v)) continue;
      const days = sums.get(k) ?? new Map<string, number[]>();
      days.set(e.date, [...(days.get(e.date) ?? []), v]);
      sums.set(k, days);
    }
  }
  const out = new Map<string, { date: string; value: number }[]>();
  for (const [k, days] of sums) {
    out.set(
      k,
      [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, vals]) => ({ date, value: avg(vals)! }))
    );
  }
  return out;
}

export function trendOf(delta: number | null, threshold: number): Trend | null {
  if (delta === null) return null;
  return delta >= threshold ? "hausse" : delta <= -threshold ? "baisse" : "stable";
}

/** Début → maintenant : les premières et les dernières pratiques notées (3 au plus de chaque côté, sans chevauchement). */
export function startNow(values: number[]): { start: number | null; now: number | null; delta: number | null } {
  if (!values.length) return { start: null, now: null, delta: null };
  if (values.length === 1) return { start: values[0], now: values[0], delta: null };
  const k = Math.min(3, Math.floor(values.length / 2));
  const start = avg(values.slice(0, k))!;
  const now = avg(values.slice(-k))!;
  return { start, now, delta: round1(now - start) };
}

function attendanceOf(rows: SummaryAttendance[]): AttendanceSummary {
  const list = rows.filter((a) => COUNTED.includes(a.status)).sort((a, b) => a.date.localeCompare(b.date));
  const present = list.filter((a) => HERE.includes(a.status)).length;
  const rate = list.length ? Math.round((present / list.length) * 100) : null;
  const last = list.slice(-6);
  const recentRate = last.length ? Math.round((last.filter((a) => HERE.includes(a.status)).length / last.length) * 100) : null;
  let streak = 0;
  for (let i = list.length - 1; i >= 0 && HERE.includes(list[i].status); i--) streak++;
  const label = rate === null ? null : rate >= 90 ? "Très assidue" : rate >= 75 ? "Assidue" : rate >= 50 ? "Présence irrégulière" : "Souvent absente";
  return { present, total: list.length, rate, recentRate, streak, label };
}

/** La première phrase d'une observation (assez longue pour dire quelque chose), coupée proprement. */
export function firstSentence(text: string, max = 220): string {
  const t = text.replace(/\s+/g, " ").trim();
  const first = t.split(/(?<=[.!?])\s+/)[0] ?? t;
  const s = first.length >= 25 ? first : t;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

function observationsOf(evals: SummaryEval[]): { date: string; text: string }[] {
  const seen = new Set<string>();
  const list: { date: string; text: string }[] = [];
  for (const e of [...evals].sort((a, b) => a.date.localeCompare(b.date))) {
    const c = String(e.comment ?? "").trim();
    if (c.length < 15) continue;
    const key = norm(c);
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ date: e.date, text: firstSentence(c) });
  }
  if (list.length <= 3) return list;
  return [list[0], list[Math.floor((list.length - 1) / 2)], list[list.length - 1]];
}

function gesturesOf(evals: SummaryEval[]): SeasonSummary["gestures"] {
  const scores = byDay(evals, (e) => e.gestureScores, (v) => v >= 1 && v <= 10);
  const days = [...new Set(evals.map((e) => e.date))].sort();
  const recentDays = new Set(days.slice(-5));
  const difficult = new Map<string, number>();
  for (const e of evals) {
    if (!recentDays.has(e.date)) continue;
    for (const g of e.gestures ?? []) if (g) difficult.set(g, (difficult.get(g) ?? 0) + 1);
  }
  const names = [...new Set([...scores.keys(), ...difficult.keys()])];
  const all: GestureProgress[] = names.map((name) => {
    const vals = (scores.get(name) ?? []).map((p) => p.value);
    const { start, now, delta } = startNow(vals);
    return { name, first: start, recent: now, delta, count: vals.length, difficult: difficult.get(name) ?? 0 };
  });
  const strong = all
    .filter((g) => g.recent !== null && g.recent >= 7 && g.difficult === 0)
    .sort((a, b) => b.recent! - a.recent! || a.name.localeCompare(b.name, "fr"))
    .slice(0, 3);
  const strongNames = new Set(strong.map((g) => g.name));
  const toWork = all
    .filter((g) => !strongNames.has(g.name) && ((g.recent !== null && g.recent < 6) || g.difficult > 0))
    .sort((a, b) => b.difficult - a.difficult || (a.recent ?? 0) - (b.recent ?? 0) || a.name.localeCompare(b.name, "fr"))
    .slice(0, 3);
  const improved = all.filter((g) => g.delta !== null && g.delta >= 2).sort((a, b) => b.delta! - a.delta!)[0] ?? null;
  return { strong, toWork, improved };
}

function headlineOf(scales: ScaleProgress[], gestures: SeasonSummary["gestures"]): string | null {
  const best = scales.filter((s) => s.trend === "hausse").sort((a, b) => b.delta! - a.delta!)[0];
  if (best) return `${best.label} : de ${fmt(best.start)} à ${fmt(best.now)} sur 5 depuis le début de la saison.`;
  if (gestures.improved) return `${gestures.improved.name} : de ${fmt(gestures.improved.first)} à ${fmt(gestures.improved.recent)} sur 10 depuis le début de la saison.`;
  const steady = scales.filter((s) => s.trend === "stable");
  if (steady.length === scales.length) return "Constante depuis le début de la saison sur ses trois échelles.";
  return null;
}

/** Le résumé de la joueuse entre deux dates. `observations: false` (version parent) : sans les notes des éducateurs,
 *  qui sont des notes de travail internes et peuvent parler d'autres enfants. */
export function summarizeSeason(input: {
  evaluations: SummaryEval[];
  attendance: SummaryAttendance[];
  objectives: SummaryObjective[];
  from: string;
  to: string;
  observations?: boolean;
}): SeasonSummary {
  const inRange = (d: string) => Boolean(d) && d >= input.from && d <= input.to;
  const evals = input.evaluations.filter((e) => inRange(e.date));
  const ratings = byDay(evals, (e) => e.ratings, (v) => v >= 1 && v <= 5);
  const scales: ScaleProgress[] = CRITERIA.map((c) => {
    const vals = (ratings.get(c.key) ?? []).map((p) => p.value);
    const { start, now, delta } = startNow(vals);
    return { key: c.key, label: c.label, detail: c.detail, start, now, delta, trend: trendOf(delta, 0.3), count: vals.length };
  });
  const gestures = gesturesOf(evals);
  return {
    from: input.from,
    to: input.to,
    practicesEvaluated: new Set(evals.filter((e) => Object.keys(e.ratings ?? {}).length || Object.keys(e.gestureScores ?? {}).length).map((e) => e.date)).size,
    scales,
    gestures,
    attendance: attendanceOf(input.attendance.filter((a) => inRange(a.date))),
    observations: input.observations === false ? [] : observationsOf(evals),
    objectives: { active: input.objectives.filter((o) => o.active).map((o) => o.text), closed: input.objectives.filter((o) => !o.active).length },
    headline: headlineOf(scales, gestures)
  };
}
