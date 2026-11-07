/** Espace JP : calculs purs (testés dans jp-core.test.ts). Habitudes (jours réussis, série, semaine), calendrier
 *  (catégorie de chaque activité, heures par catégorie) et nutrition. La base est dans `jp-repo.ts`. */

export interface Habit {
  id: string;
  name: string;
  kind: "check" | "nombre";
  unit: string | null;
  /** check : jours visés par semaine ; nombre : valeur visée chaque jour. */
  target: number;
  active: boolean;
  sort_order: number;
}

export interface HabitLog {
  habit_id: string;
  day: string;
  value: number;
}

export const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Lundi de la semaine de `day`. */
export function mondayOf(day: string): string {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
  return addDays(day, -((dow + 6) % 7));
}

export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/** Le jour est-il réussi ? Case : cochée. Nombre : la valeur atteint la cible du jour. */
export function dayMet(h: Pick<Habit, "kind" | "target">, value: number | null | undefined): boolean {
  if (value === null || value === undefined) return false;
  return h.kind === "check" ? value >= 1 : value >= h.target;
}

export interface HabitWeek {
  habit: Habit;
  days: { day: string; value: number | null; met: boolean }[];
  met: number;
  /** Jours visés cette semaine (case : la cible ; nombre : 7). */
  goal: number;
  /** Série de jours réussis de suite, jusqu'à aujourd'hui (aujourd'hui pas encore noté ne la casse pas). */
  streak: number;
  /** Moyenne de la semaine (habitude « nombre »). */
  average: number | null;
}

export function habitWeek(habit: Habit, logs: HabitLog[], today: string): HabitWeek {
  const mine = new Map(logs.filter((l) => l.habit_id === habit.id).map((l) => [l.day, Number(l.value)]));
  const days = weekDays(mondayOf(today)).map((day) => {
    const value = mine.has(day) ? mine.get(day)! : null;
    return { day, value, met: dayMet(habit, value) };
  });
  let streak = 0;
  let d = dayMet(habit, mine.get(today)) ? today : addDays(today, -1);
  while (dayMet(habit, mine.get(d))) {
    streak++;
    d = addDays(d, -1);
  }
  const noted = days.filter((x) => x.value !== null && x.day <= today).map((x) => x.value as number);
  return {
    habit,
    days,
    met: days.filter((x) => x.met).length,
    goal: habit.kind === "check" ? Math.min(7, habit.target) : 7,
    streak,
    average: habit.kind === "nombre" && noted.length ? Math.round((noted.reduce((s, x) => s + x, 0) / noted.length) * 10) / 10 : null
  };
}

/** Score de la semaine (0 à 1) : jours réussis sur jours visés, chaque habitude pèse pareil. */
export function weekScore(weeks: HabitWeek[]): number | null {
  const xs = weeks.filter((w) => w.goal > 0).map((w) => Math.min(1, w.met / w.goal));
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
}

// ───────────────────────── Calendrier ─────────────────────────

export type TimeCategory = "terrain" | "contenu" | "ventes" | "formation" | "admin" | "perso" | "autre";

export const CATEGORY_LABEL: Record<TimeCategory, string> = {
  terrain: "Terrain (pratiques, matchs, coaching)",
  contenu: "Contenu et image personnelle",
  ventes: "Ventes, partenaires, appels",
  formation: "Formation et lecture",
  admin: "Administration et planification",
  perso: "Personnel, famille, santé",
  autre: "Autre"
};

export const CATEGORY_COLOR: Record<TimeCategory, string> = {
  terrain: "#5fd38a",
  contenu: "#c3a6ff",
  ventes: "#f0c878",
  formation: "#78a8f0",
  admin: "#9d9da0",
  perso: "#ff9999",
  autre: "#6b6478"
};

const plain = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const RULES: [TimeCategory, RegExp][] = [
  ["contenu", /contenu|montage|tournage|video|🎥|🎬|publication|reel|tiktok|instagram|podcast|balado|branding|image perso/],
  ["formation", /formation|cours|diplome|lecture|livre|rseq|conference|webinaire|cohorte|apprendre/],
  ["ventes", /appel|rencontre|consultation|decouverte|partenaire|commandit|vente|client|meeting|reunion|growthlab|entrevue/],
  ["terrain", /pratique|coaching|match|futsal|entrainement|seance|soccer|tournoi|essai|camp|semi.?prive|terrain/],
  ["admin", /admin|planification|comptab|budget|paie|courriel|mandalart|bilan|impot|banque/],
  ["perso", /famille|gym|muscu|course|souper|anniversaire|medecin|dentiste|repos|vacances|sommeil|perso/]
];

export function categorize(summary: string): TimeCategory {
  const s = plain(summary);
  for (const [cat, re] of RULES) if (re.test(s)) return cat;
  return "autre";
}

export interface CalEvent {
  summary: string;
  date: string;
  start: string | null;
  end: string | null;
  startMs: number;
  endMs: number;
  allDay: boolean;
}

export interface WeekTime {
  monday: string;
  /** Heures planifiées par catégorie. */
  byCategory: { category: TimeCategory; hours: number }[];
  total: number;
  /** Heures planifiées par jour (lundi → dimanche). */
  byDay: { day: string; hours: number }[];
}

export function weekTime(events: CalEvent[], monday: string): WeekTime {
  const days = weekDays(monday);
  const inWeek = events.filter((e) => !e.allDay && e.date >= days[0] && e.date <= days[6] && e.endMs > e.startMs);
  const hours = (e: CalEvent) => Math.min(16, (e.endMs - e.startMs) / 3_600_000);
  const cats = new Map<TimeCategory, number>();
  for (const e of inWeek) cats.set(categorize(e.summary), (cats.get(categorize(e.summary)) ?? 0) + hours(e));
  const round = (x: number) => Math.round(x * 10) / 10;
  const byCategory = (Object.keys(CATEGORY_LABEL) as TimeCategory[]).map((category) => ({ category, hours: round(cats.get(category) ?? 0) })).filter((c) => c.hours > 0).sort((a, b) => b.hours - a.hours);
  return {
    monday,
    byCategory,
    total: round(inWeek.reduce((s, e) => s + hours(e), 0)),
    byDay: days.map((day) => ({ day, hours: round(inWeek.filter((e) => e.date === day).reduce((s, e) => s + hours(e), 0)) }))
  };
}

// ───────────────────────── Nutrition ─────────────────────────

export const MEAL_LABEL = { dejeuner: "Déjeuner", diner: "Dîner", souper: "Souper", collation: "Collation", "avant-match": "Avant la pratique ou le match", eau: "Eau" } as const;
export type MealMoment = keyof typeof MEAL_LABEL;
export const QUALITY_LABEL = { bien: "Bien", moyen: "Moyen", "a-ameliorer": "À améliorer" } as const;

export interface Meal {
  id: string;
  day: string;
  moment: MealMoment;
  description: string;
  protein_g: number | null;
  quality: keyof typeof QUALITY_LABEL | null;
}

export function nutritionDay(meals: Meal[], day: string) {
  const mine = meals.filter((m) => m.day === day);
  const rated = mine.filter((m) => m.quality);
  return {
    meals: mine,
    protein: mine.reduce((s, m) => s + (m.protein_g ?? 0), 0),
    good: rated.length ? rated.filter((m) => m.quality === "bien").length / rated.length : null,
    mainMeals: new Set(mine.filter((m) => m.moment === "dejeuner" || m.moment === "diner" || m.moment === "souper").map((m) => m.moment)).size
  };
}

// ───────────────────────── Connaissances ─────────────────────────

export const SOURCE_LABEL = { livre: "Livre", video: "Vidéo", cours: "Cours", balado: "Balado", mentor: "Mentor", article: "Article", experience: "Expérience vécue" } as const;
export type SourceType = keyof typeof SOURCE_LABEL;
export const KNOWLEDGE_STATUS_LABEL = { "a-lire": "À lire / écouter", "en-cours": "En cours", fini: "Fini" } as const;

export const parseTags = (s: string) => [...new Set(s.split(/[,#]/).map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2 && t.length <= 30))].slice(0, 10);
