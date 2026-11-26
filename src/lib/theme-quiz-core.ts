/** « Qu'est-ce qu'on a travaillé aujourd'hui ? » sur la borne (JP, 25 nov. 2026) : 3 choix, dont un seul est le thème
 *  de la semaine du groupe ; les 2 autres sont d'autres thèmes du plan de l'année (d'un autre bloc, jamais proches du
 *  bon) ou, à défaut, des thèmes de soccer simples. Les choix et leur ordre ne dépendent que de la pratique : toutes
 *  les filles du groupe voient les mêmes 3 choix, dans le même ordre. La fille ne voit jamais si elle a bon ; les
 *  éducateurs et JP voient qui a compris. Règles pures (theme-quiz-core.test.ts). */

import { LESSON_THEMES } from "@/lib/match-results-core";

export interface ThemeQuiz {
  /** Le bon thème, en mots courts (« Réduction des espaces »). */
  correct: string;
  /** Les 3 choix, mélangés (le bon compris). */
  choices: string[];
}

/** Texte comparable : minuscules, sans accents, espaces simples. */
export const normTheme = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Les années d'une catégorie (« 2014-2015 avancé » → 2014, 2015). */
const yearsOf = (s: string | null | undefined): string[] => (s ?? "").match(/\b20\d{2}\b/g) ?? [];

/** Le thème d'une semaine pour un groupe : celui de sa catégorie (« 2016-2017 » prend celui de « 2016 » ou
 *  « 2017 » s'il n'y en a pas pour « 2016-2017 »), sinon celui de tout le monde. Un thème de tout le monde écrit
 *  « A (2014-2015) · B (2016-2017) » donne la partie du groupe. */
export function themeForGroup(theme: { theme: string; by_category?: Record<string, string> | null } | null | undefined, category: string | null | undefined): string | null {
  if (!theme) return null;
  const cats = theme.by_category ?? {};
  const cat = (category ?? "").trim();
  const own = (cat && cats[cat]?.trim()) || "";
  if (own) return own;
  const years = yearsOf(cat);
  for (const y of years) {
    const key = Object.keys(cats).find((k) => k.trim() === y) ?? Object.keys(cats).find((k) => yearsOf(k).includes(y));
    if (key && cats[key]?.trim()) return cats[key].trim();
  }
  const general = String(theme.theme ?? "").trim();
  if (!general) return null;
  const parts = general.split(/\s+·\s+/);
  if (parts.length > 1 && years.length) {
    const mine = parts.find((p) => yearsOf(p.match(/\(([^)]*)\)/)?.[1]).some((y) => years.includes(y)));
    if (mine) return mine.trim();
  }
  return general;
}

/** Le thème en mots courts, pour un bouton : avant « : », « ( » ou « · » (« Réduction des espaces : se resserrer… »
 *  → « Réduction des espaces »). */
export function shortTheme(text: string | null | undefined): string {
  const first = String(text ?? "")
    .split(/\s+·\s+/)[0]
    .split(/\s+:\s+|\s*\(/)[0]
    .replace(/[\s.,;:]+$/, "")
    .trim();
  return first.length > 60 ? `${first.slice(0, 57).trim()}…` : first;
}

/** Une semaine d'évaluation ou de tests n'est pas un thème à deviner. */
export const isEvaluationTheme = (text: string) => /\b(evaluation|tests?)\b/.test(normTheme(text));

/** Les familles de soccer d'un libellé (passes, défense, placement…), pour ne jamais proposer un faux choix trop
 *  proche du bon (ex. « Cadrage-couverture » et « Défense et repli »). */
export function themeFamilies(label: string): string[] {
  const t = normTheme(label);
  return LESSON_THEMES.filter((f) => f.patterns.some((p) => p.test(t))).map((f) => f.key);
}

const STOP = new Set(["avec", "dans", "entre", "pour", "vers", "les", "des", "une", "jeu", "son", "sur", "nos", "notre"]);
const words = (label: string) => normTheme(label).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w));

/** Thèmes de soccer simples, quand le plan de l'année n'en a pas assez d'autres (familles toutes différentes). */
export const FALLBACK_THEMES = ["Le tir au but", "Les jongles", "Le jeu de tête", "Les coups de coin", "La gardienne de but", "Le dribble et le 1 contre 1", "Les passes"];

/** Petit hachage stable (FNV-1a) : le même texte donne toujours le même nombre. */
export function stableHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mélange stable : le même ordre pour la même graine. */
export function stableShuffle<T>(items: T[], seed: string, key: (x: T) => string): T[] {
  return [...items].sort((a, b) => stableHash(`${seed}|${key(a)}`) - stableHash(`${seed}|${key(b)}`) || key(a).localeCompare(key(b)));
}

export interface ThemePoolItem {
  /** Texte du thème (long ou court). */
  text: string;
  /** Son bloc (« Récupération du ballon ») : un faux choix ne vient jamais du même bloc que le bon. */
  block?: string | null;
}

/** Les 3 choix de la question, ou null quand la pratique n'a pas de thème (on ne pose pas la question).
 *  `seed` = l'id de la pratique ; `avoid` = les thèmes des autres groupes sur le terrain à la même heure. */
export function buildThemeQuiz(input: { correct: string | null | undefined; block?: string | null; pool: ThemePoolItem[]; seed: string; avoid?: string[] }): ThemeQuiz | null {
  const correct = shortTheme(input.correct);
  if (!correct || isEvaluationTheme(correct)) return null;
  const banned = [correct, ...(input.avoid ?? []).map(shortTheme)].filter(Boolean);
  const bannedNorm = new Set(banned.map(normTheme));
  const bannedWords = new Set(banned.flatMap(words));
  const bannedFamilies = new Set(banned.flatMap(themeFamilies));
  const block = input.block ? normTheme(input.block) : null;

  const ok = (label: string, picked: string[]) => {
    const n = normTheme(label);
    if (!n || bannedNorm.has(n) || isEvaluationTheme(label)) return false;
    if (words(label).some((w) => bannedWords.has(w))) return false;
    if (themeFamilies(label).some((f) => bannedFamilies.has(f))) return false;
    // Les 2 faux choix ne se ressemblent pas non plus entre eux.
    return picked.every((p) => normTheme(p) !== n && !words(p).some((w) => words(label).includes(w)) && !themeFamilies(p).some((f) => themeFamilies(label).includes(f)));
  };

  const seen = new Set<string>();
  const season: string[] = [];
  for (const item of input.pool) {
    if (block && item.block && normTheme(item.block) === block) continue;
    for (const part of String(item.text ?? "").split(/\s+·\s+/)) {
      const label = shortTheme(part);
      const n = normTheme(label);
      if (!label || seen.has(n)) continue;
      seen.add(n);
      season.push(label);
    }
  }
  const picked: string[] = [];
  for (const label of [...stableShuffle(season, input.seed, normTheme), ...stableShuffle(FALLBACK_THEMES, input.seed, normTheme)]) {
    if (picked.length === 2) break;
    if (ok(label, picked)) picked.push(label);
  }
  // Repli ultime (plan très chargé en thèmes proches) : des thèmes simples, seulement différents du bon.
  for (const label of FALLBACK_THEMES) {
    if (picked.length === 2) break;
    if (!bannedNorm.has(normTheme(label)) && !picked.includes(label)) picked.push(label);
  }
  return { correct, choices: stableShuffle([correct, ...picked], `${input.seed}|ordre`, normTheme) };
}

/** La réponse de la fille est-elle le bon thème ? */
export const isThemeCorrect = (answer: string | null | undefined, correct: string | null | undefined) => Boolean(answer && correct && normTheme(answer) === normTheme(correct));

/** Nettoie le choix envoyé par la borne : un des choix proposés, sinon null (ignoré). */
export function parseThemeAnswer(raw: unknown, quiz: ThemeQuiz | null): string | null {
  if (!quiz || typeof raw !== "string") return null;
  const n = normTheme(raw);
  return quiz.choices.find((c) => normTheme(c) === n) ?? null;
}

export type ThemeStatus = "compris" | "pas-compris" | "pas-repondu";

/** Qui a compris le thème : « compris », « pas-compris » ou « pas-repondu » pour chaque fille présente. */
export function themeStatusOf(row: { theme_correct?: boolean | null } | null | undefined): ThemeStatus {
  return row?.theme_correct === true ? "compris" : row?.theme_correct === false ? "pas-compris" : "pas-repondu";
}

export interface ThemeRow {
  date: string;
  activity_id: string;
  theme_correct?: boolean | null;
}

export interface ThemeRate {
  answered: number;
  understood: number;
  /** understood / answered, de 0 à 100 ; null sans réponse. */
  pct: number | null;
}

const rate = (rows: ThemeRow[]): ThemeRate => {
  const asked = rows.filter((r) => r.theme_correct === true || r.theme_correct === false);
  const understood = asked.filter((r) => r.theme_correct === true).length;
  return { answered: asked.length, understood, pct: asked.length ? Math.round((understood / asked.length) * 100) : null };
};

/** Part des filles qui ont compris le thème, pour chaque pratique (la plus récente d'abord). */
export function themeRateByPractice(rows: ThemeRow[]): (ThemeRate & { activityId: string; date: string })[] {
  const by = new Map<string, ThemeRow[]>();
  for (const r of rows) by.set(r.activity_id, [...(by.get(r.activity_id) ?? []), r]);
  return [...by.entries()]
    .map(([activityId, rs]) => ({ activityId, date: rs[0].date, ...rate(rs) }))
    .filter((p) => p.answered > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Le lundi d'une date (AAAA-MM-JJ). */
const mondayOf = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

/** Part des filles qui ont compris le thème, semaine par semaine (la plus ancienne d'abord). */
export function themeRateByWeek(rows: ThemeRow[]): (ThemeRate & { week: string })[] {
  const by = new Map<string, ThemeRow[]>();
  for (const r of rows) {
    if (r.theme_correct !== true && r.theme_correct !== false) continue;
    const w = mondayOf(r.date);
    by.set(w, [...(by.get(w) ?? []), r]);
  }
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, rs]) => ({ week, ...rate(rs) }));
}

/** JP, 26 nov. 2026 : sous 80 % des filles qui ont trouvé le thème, c'est un échec de compréhension du thème. */
export const THEME_PASS_PCT = 80;
export const THEME_FAIL_LABEL = "Échec de compréhension du thème";

/** « compris » à 80 % et plus, « echec » en dessous, null sans réponse. */
export function themeVerdict(pct: number | null | undefined): "compris" | "echec" | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  return pct >= THEME_PASS_PCT ? "compris" : "echec";
}
