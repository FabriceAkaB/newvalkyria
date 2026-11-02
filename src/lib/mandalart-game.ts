/** Le Mandalart en jeu (demande de JP, 2 nov. 2026) : des petites bouchées, de l'XP, une série de
 *  jours, des rangs, et une carte du voyage vers 1,5 M$ qui dit si on arrive à temps.
 *  Calculs purs, testés dans mandalart-core.test.ts. */

import { isOpen, weight, type LevelProgress, type LiveTask } from "@/lib/mandalart-core";

export const XP_PER_WEIGHT = 50; // ⭐ faite = 100 XP, ➜ faite = 50 XP, en cours = la moitié

export function xpOf(tasks: LiveTask[]): number {
  return tasks.reduce((s, t) => s + (t.status === "fait" ? 1 : t.status === "en_cours" ? 0.5 : 0) * weight(t.priority) * XP_PER_WEIGHT, 0);
}

export const RANKS = [
  { xp: 0, name: "Recrue", icon: "🥾" },
  { xp: 500, name: "Titulaire", icon: "⚽" },
  { xp: 1500, name: "Capitaine", icon: "🎖️" },
  { xp: 3500, name: "Coach-chef", icon: "📋" },
  { xp: 7000, name: "Directeur technique", icon: "🧠" },
  { xp: 12000, name: "Légende du 1,5 M$", icon: "🏆" }
];

export function rankOf(xp: number) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const next = RANKS[i + 1] ?? null;
  return { ...RANKS[i], index: i, next, toNext: next ? next.xp - xp : 0, progress: next ? (xp - RANKS[i].xp) / (next.xp - RANKS[i].xp) : 1 };
}

/** Série : jours consécutifs (jusqu'à aujourd'hui, ou hier si rien encore aujourd'hui) avec au moins une tâche faite. */
export function streakOf(doneDays: string[], today: string): number {
  const days = new Set(doneDays);
  const shift = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
  let d = days.has(today) ? today : shift(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = shift(d, -1);
  }
  return n;
}

/** Quête du jour : 3 petites bouchées. D'abord le retard, puis les ⭐ du niveau actuel par échéance,
 *  puis les ⭐ à préparer d'avance. Une tâche « en cours » passe avant une tâche pas commencée. */
export function dailyQuest(tasks: LiveTask[], level: number, n = 3): LiveTask[] {
  const open = tasks.filter(isOpen);
  const byDue = (a: LiveTask, b: LiveTask) => (a.status === "en_cours" ? -1 : 0) - (b.status === "en_cours" ? -1 : 0) || (a.due ?? "9999").localeCompare(b.due ?? "9999");
  const picked: LiveTask[] = [];
  const add = (list: LiveTask[]) => {
    for (const t of list.sort(byDue)) if (picked.length < n && !picked.includes(t)) picked.push(t);
  };
  add(open.filter((t) => t.overdue));
  add(open.filter((t) => t.level === level && t.priority === "star"));
  add(open.filter((t) => t.priority === "star"));
  add(open.filter((t) => t.level === level));
  return picked;
}

export interface JourneyStop {
  id: number;
  name: string;
  end: string;
  progress: number;
  state: LevelProgress["state"];
  /** Date prévue de fin au rythme des 4 dernières semaines (niveau en cours seulement). */
  projected: string | null;
  onTrack: boolean | null;
  weeksLate: number;
}

/** Rythme = poids des tâches faites dans les 28 derniers jours ÷ 4 semaines. */
export function journey(levels: LevelProgress[], tasks: LiveTask[], doneDates: { code: string; date: string }[], today: string): { stops: JourneyStop[]; pacePerWeek: number } {
  const since = new Date(Date.parse(`${today}T12:00:00Z`) - 28 * 86400000).toISOString().slice(0, 10);
  const recent = new Set(doneDates.filter((d) => d.date >= since).map((d) => d.code));
  // Rythme mesuré sur 4 semaines, ou depuis la première tâche cochée si c'est plus récent (au moins 7 jours d'historique pour juger).
  const first = doneDates.map((d) => d.date).sort()[0];
  const historyDays = first ? Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / 86400000) + 1 : 0;
  const weeks = Math.min(4, Math.max(1, historyDays / 7));
  const pace = historyDays >= 7 ? tasks.filter((t) => t.status === "fait" && recent.has(t.code)).reduce((s, t) => s + weight(t.priority), 0) / weeks : 0;
  const stops = levels.map((l) => {
    let projected: string | null = null;
    let onTrack: boolean | null = null;
    let weeksLate = 0;
    if (l.state === "en_cours") {
      const remaining = tasks.filter((t) => t.level === l.id && isOpen(t)).reduce((s, t) => s + weight(t.priority) * (t.status === "en_cours" ? 0.5 : 1), 0);
      if (pace > 0) {
        const weeks = remaining / pace;
        projected = new Date(Date.parse(`${today}T12:00:00Z`) + weeks * 7 * 86400000).toISOString().slice(0, 10);
        onTrack = projected <= l.end;
        weeksLate = onTrack ? 0 : Math.ceil((Date.parse(projected) - Date.parse(l.end)) / (7 * 86400000));
      }
    }
    return { id: l.id, name: l.name, end: l.end, progress: l.progress, state: l.state, projected, onTrack, weeksLate };
  });
  return { stops, pacePerWeek: pace };
}
