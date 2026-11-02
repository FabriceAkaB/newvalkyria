/** Calculs purs du Mandalart (section 2 du plan) : aucun accès à la base, testés dans
 *  mandalart-core.test.ts.
 *  - statut : à faire 0 · en cours 0,5 · fait 1 · abandonnée exclue
 *  - poids : ⭐ compte double, ➜ une fois
 *  - objectif = moyenne pondérée de ses tâches ; pilier = moyenne de ses objectifs ; exécution = moyenne des piliers
 *  - niveau actuel = premier niveau qui a encore des ⭐ non faites
 *  - médailles : bronze 25 %, argent 50 %, or 100 %, mauve quand les cibles des indicateurs sont atteintes */

import type { MandalartPlan, PlanTask, Priority, TaskStatus } from "@/lib/mandalart-plan";

export interface TaskState {
  code: string;
  status: TaskStatus;
  note: string | null;
  evidence_url: string | null;
  done_at: string | null;
  updated_at?: string | null;
}

export interface CustomTask {
  code: string;
  objective: string;
  title: string;
  level: number;
  priority: Priority;
  due: string | null;
  owner: string | null;
}

export interface LiveTask extends PlanTask {
  status: TaskStatus;
  note: string | null;
  evidenceUrl: string | null;
  doneAt: string | null;
  objective: string;
  objectiveName: string;
  pillar: string;
  overdue: boolean;
  custom: boolean;
}

export type Medal = "bronze" | "argent" | "or" | "mauve" | null;

export const STATUS_SCORE: Record<TaskStatus, number | null> = { a_faire: 0, en_cours: 0.5, fait: 1, abandonne: null };
export const STATUS_LABEL: Record<TaskStatus, string> = { a_faire: "À faire", en_cours: "En cours", fait: "Fait", abandonne: "Abandonnée" };
export const NEXT_STATUS: Record<TaskStatus, TaskStatus> = { a_faire: "en_cours", en_cours: "fait", fait: "a_faire", abandonne: "a_faire" };

export const weight = (p: Priority) => (p === "star" ? 2 : 1);
export const isOpen = (t: { status: TaskStatus }) => t.status === "a_faire" || t.status === "en_cours";

/** Réunit le plan (JSON) et l'état en base. Une tâche sans état garde le statut écrit dans le plan
 *  ([x] → fait) ; un état en base n'est jamais écrasé par une nouvelle version du plan. */
export function buildLiveTasks(plan: MandalartPlan, states: TaskState[], customs: CustomTask[], today: string): LiveTask[] {
  const byCode = new Map(states.map((s) => [s.code, s]));
  const out: LiveTask[] = [];
  for (const p of plan.pillars) {
    for (const o of p.objectives) {
      const extra: PlanTask[] = customs
        .filter((c) => c.objective === o.code)
        .map((c) => ({ code: c.code, priority: c.priority, level: c.level, title: c.title, due: c.due, owner: c.owner, links: [], initialStatus: "a_faire" as TaskStatus }));
      for (const t of [...o.tasks, ...extra]) {
        const s = byCode.get(t.code);
        const status = s?.status ?? t.initialStatus;
        out.push({
          ...t,
          status,
          note: s?.note ?? null,
          evidenceUrl: s?.evidence_url ?? null,
          doneAt: s?.done_at ?? null,
          objective: o.code,
          objectiveName: o.name,
          pillar: p.code,
          overdue: (status === "a_faire" || status === "en_cours") && !!t.due && t.due < today,
          custom: extra.includes(t)
        });
      }
    }
  }
  return out;
}

/** Moyenne pondérée (0 à 1) ; null s'il n'y a aucune tâche comptée. */
export function progressOf(tasks: { status: TaskStatus; priority: Priority }[]): number | null {
  let num = 0;
  let den = 0;
  for (const t of tasks) {
    const s = STATUS_SCORE[t.status];
    if (s === null) continue;
    num += s * weight(t.priority);
    den += weight(t.priority);
  }
  return den === 0 ? null : num / den;
}

const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

export interface ObjectiveProgress {
  code: string;
  name: string;
  progress: number;
  medal: Medal;
  total: number;
  done: number;
  overdue: number;
  kpis: string[];
}

export interface PillarProgress {
  code: string;
  name: string;
  progress: number;
  objectives: ObjectiveProgress[];
  medals: Record<Exclude<Medal, null>, number>;
  overdue: number;
  starsOpen: number;
}

export function medalFor(progress: number, kpisMet: boolean): Medal {
  if (kpisMet) return "mauve";
  if (progress >= 1) return "or";
  if (progress >= 0.5) return "argent";
  if (progress >= 0.25) return "bronze";
  return null;
}

/** kpiMet(id) : vrai si la cible de cet indicateur est atteinte. Un objectif sans indicateur n'a pas de mauve. */
export function pillarProgress(plan: MandalartPlan, tasks: LiveTask[], kpiMet: (id: string) => boolean = () => false): PillarProgress[] {
  return plan.pillars.map((p) => {
    const objectives = p.objectives.map((o) => {
      const ts = tasks.filter((t) => t.objective === o.code);
      const progress = progressOf(ts) ?? 0;
      const met = o.kpis.length > 0 && o.kpis.every(kpiMet);
      return {
        code: o.code,
        name: o.name,
        progress,
        medal: medalFor(progress, met),
        total: ts.filter((t) => t.status !== "abandonne").length,
        done: ts.filter((t) => t.status === "fait").length,
        overdue: ts.filter((t) => t.overdue).length,
        kpis: o.kpis
      };
    });
    const medals = { bronze: 0, argent: 0, or: 0, mauve: 0 };
    for (const o of objectives) if (o.medal) medals[o.medal]++;
    const pts = tasks.filter((t) => t.pillar === p.code);
    return {
      code: p.code,
      name: p.name,
      progress: mean(objectives.map((o) => o.progress)) ?? 0,
      objectives,
      medals,
      overdue: pts.filter((t) => t.overdue).length,
      starsOpen: pts.filter((t) => t.priority === "star" && isOpen(t)).length
    };
  });
}

export const executionOf = (pillars: PillarProgress[]) => mean(pillars.map((p) => p.progress)) ?? 0;

export interface LevelProgress {
  id: number;
  code: string;
  name: string;
  start: string;
  end: string;
  goal: string;
  total: number;
  done: number;
  stars: number;
  starsDone: number;
  progress: number;
  state: "fait" | "en_cours" | "a_venir";
  daysLeft: number;
  overdue: number;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}

/** Niveau actuel = premier niveau qui a encore des ⭐ non faites (abandonnées exclues). */
export function currentLevelId(tasks: LiveTask[], levelIds: number[]): number {
  for (const id of levelIds) if (tasks.some((t) => t.level === id && t.priority === "star" && isOpen(t))) return id;
  return levelIds[levelIds.length - 1];
}

export function levelProgress(plan: MandalartPlan, tasks: LiveTask[], today: string): { levels: LevelProgress[]; current: number } {
  const current = currentLevelId(tasks, plan.levels.map((l) => l.id));
  const levels = plan.levels.map((l) => {
    const ts = tasks.filter((t) => t.level === l.id && t.status !== "abandonne");
    const stars = ts.filter((t) => t.priority === "star");
    const starsDone = stars.filter((t) => t.status === "fait").length;
    return {
      ...l,
      total: ts.length,
      done: ts.filter((t) => t.status === "fait").length,
      stars: stars.length,
      starsDone,
      progress: progressOf(ts) ?? 0,
      state: (l.id < current || (stars.length > 0 && starsDone === stars.length) ? "fait" : l.id === current ? "en_cours" : "a_venir") as LevelProgress["state"],
      daysLeft: Math.max(0, daysBetween(today, l.end)),
      overdue: ts.filter((t) => t.overdue).length
    };
  });
  return { levels, current };
}

const byDue = (a: LiveTask, b: LiveTask) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.code.localeCompare(b.code);

/** « À faire maintenant » : les ⭐ non faites du niveau actuel par échéance (7 au maximum), puis les ➜ du même niveau. */
export function nowList(tasks: LiveTask[], level: number, maxStars = 7): { stars: LiveTask[]; moreStars: number; progressive: LiveTask[] } {
  const open = tasks.filter((t) => t.level === level && isOpen(t)).sort(byDue);
  const stars = open.filter((t) => t.priority === "star");
  return { stars: stars.slice(0, maxStars), moreStars: Math.max(0, stars.length - maxStars), progressive: open.filter((t) => t.priority === "progressive") };
}

export interface MonthFocus {
  month: string;
  overdue: LiveTask[];
  dueThisMonth: LiveTask[];
  /** Règle d'anticipation : ⭐ dues dans les 2 mois suivants, à commencer maintenant. */
  prepare: LiveTask[];
  doneThisMonth: LiveTask[];
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthFocus(tasks: LiveTask[], today: string): MonthFocus {
  const month = today.slice(0, 7);
  const horizon = addMonths(month, 3);
  return {
    month,
    overdue: tasks.filter((t) => t.overdue).sort(byDue),
    dueThisMonth: tasks.filter((t) => isOpen(t) && !t.overdue && t.due?.startsWith(month)).sort((a, b) => weight(b.priority) - weight(a.priority) || byDue(a, b)),
    prepare: tasks.filter((t) => isOpen(t) && t.priority === "star" && !!t.due && t.due.slice(0, 7) > month && t.due.slice(0, 7) < horizon).sort(byDue),
    doneThisMonth: tasks.filter((t) => t.status === "fait" && t.doneAt?.slice(0, 7) === month)
  };
}

// ── Indicateurs ──

export interface ParsedNumber {
  value: number | null;
  unit: "$" | "%" | "/10" | "mois" | "";
  lowerIsBetter: boolean;
}

/** Lit le premier nombre d'un texte du plan : « 106 986 $ (2026…) », « 74 % (37 familles…) », « ≤ 70 $ », « 9/10 », « à mesurer ». */
export function parseKpiNumber(text: string): ParsedNumber {
  const t = text.replace(/ | /g, " ");
  const lowerIsBetter = /^≤/.test(t.trim());
  const m = t.match(/(-?\d[\d ]*(?:,\d+)?)\s*(\$|%|\/10|mois)?/);
  if (!m) return { value: null, unit: "", lowerIsBetter };
  const value = Number(m[1].replace(/ /g, "").replace(",", "."));
  return { value: Number.isFinite(value) ? value : null, unit: (m[2] as ParsedNumber["unit"]) ?? "", lowerIsBetter };
}

/** Distance réelle à la cible : (actuel − départ) ÷ (cible − départ), entre 0 et 1. */
export function kpiProgress(start: number | null, target: number | null, current: number | null, lowerIsBetter = false): number | null {
  if (current === null || target === null) return null;
  if (lowerIsBetter) return current <= target ? 1 : start !== null && start > target ? Math.max(0, Math.min(1, (start - current) / (start - target))) : 0;
  const s = start ?? 0;
  if (target === s) return current >= target ? 1 : 0;
  return Math.max(0, Math.min(1, (current - s) / (target - s)));
}

export const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${Math.round(x * 100)} %`);
