import { DIFFICULT_MAX } from "@/lib/gesture-scores";
import { formatGain, LEVEL_LABEL, PASSPORT_LEVELS, progressFor, type PassportLevel, type SkillTest, type TestResult } from "@/lib/skill-tests";

/** Le passeport d'une fille vu par sa famille (P4.3.02 partie numérique, P1.7.10) : règles pures, sans base de données.
 *  Tout vient de ce que l'équipe saisit déjà : tests du passeport (skill_tests, skill_test_results) et notes par geste
 *  du ball mastery (player_evaluations.gesture_scores, gestures). Chaque fille est comparée à elle-même, jamais aux
 *  autres (P1.5.03) : aucun classement, aucune moyenne de groupe. */

/** Note sur 10 à partir de laquelle un geste est « réussi » (au-dessus de DIFFICULT_MAX, il est « en progrès »). */
export const GESTURE_SUCCESS_MIN = 8;

export interface PassportTestLine {
  testId: string;
  name: string;
  unit: string;
  last: number;
  lastOn: string;
  level: PassportLevel | null;
  /** Écart avec son premier test, dans le sens du progrès (« +6 touches », « 1,2 s plus vite »), null si un seul test. */
  sinceFirst: string | null;
  count: number;
}

export type GestureState = "reussi" | "en-progres" | "a-travailler";

export interface PassportGesture {
  name: string;
  state: GestureState;
  /** Dernière note sur 10 (null : signalé difficile par l'éducatrice sans note). */
  last: number | null;
  /** Écart avec sa première note de ce geste (null si une seule note). */
  sinceFirst: number | null;
  /** Niveau du passeport du geste dans la méthode Valkyria, s'il y figure. */
  level: PassportLevel | null;
}

export interface FamilyPassportData {
  /** Niveau tenu à tous ses tests notés (le plus bas des niveaux atteints) ; null tant qu'aucun seuil n'est atteint. */
  level: PassportLevel | null;
  next: PassportLevel | null;
  tests: PassportTestLine[];
  gestures: PassportGesture[];
  empty: boolean;
}

export interface EvaluationGestures {
  date: string;
  gesture_scores?: Record<string, number> | null;
  gestures?: string[] | null;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export const gestureState = (score: number): GestureState => (score >= GESTURE_SUCCESS_MIN ? "reussi" : score <= DIFFICULT_MAX ? "a-travailler" : "en-progres");

export function buildFamilyPassport(input: {
  tests: SkillTest[];
  results: TestResult[];
  evaluations: EvaluationGestures[];
  methodGestures?: { name: string; passport_level: PassportLevel | null }[];
}): FamilyPassportData {
  const tests: PassportTestLine[] = [];
  const levels: (PassportLevel | null)[] = [];
  for (const t of input.tests) {
    const pr = progressFor(t, input.results);
    if (!pr) continue;
    const hasThresholds = PASSPORT_LEVELS.some((l) => t.thresholds?.[l] !== undefined && t.thresholds?.[l] !== null);
    if (hasThresholds) levels.push(pr.level);
    tests.push({
      testId: t.id,
      name: t.name,
      unit: t.unit,
      last: pr.last.score,
      lastOn: pr.last.tested_on,
      level: pr.level,
      sinceFirst: pr.sinceFirst === null ? null : formatGain(t, pr.sinceFirst),
      count: pr.count
    });
  }
  const level = levels.length && levels.every(Boolean) ? (levels as PassportLevel[]).reduce((lo, l) => (PASSPORT_LEVELS.indexOf(l) < PASSPORT_LEVELS.indexOf(lo) ? l : lo)) : null;
  const next = level ? PASSPORT_LEVELS[PASSPORT_LEVELS.indexOf(level) + 1] ?? null : levels.length ? "bronze" : null;

  // Notes par geste, dans l'ordre des pratiques : la dernière fait foi, la première sert de point de départ.
  const evals = [...input.evaluations].sort((a, b) => a.date.localeCompare(b.date));
  const timeline = new Map<string, { name: string; scores: number[] }>();
  for (const e of evals) {
    for (const [name, v] of Object.entries(e.gesture_scores ?? {})) {
      const n = Number(v);
      if (!name.trim() || !Number.isFinite(n)) continue;
      const k = norm(name);
      const cur = timeline.get(k) ?? { name: name.trim(), scores: [] };
      cur.scores.push(n);
      timeline.set(k, cur);
    }
  }
  const lastDate = evals.length ? evals[evals.length - 1].date : null;
  const flagged = new Set<string>();
  const flaggedNames = new Map<string, string>();
  for (const e of evals.filter((x) => x.date === lastDate)) {
    for (const g of Array.isArray(e.gestures) ? e.gestures : []) {
      if (typeof g !== "string" || !g.trim()) continue;
      flagged.add(norm(g));
      flaggedNames.set(norm(g), g.trim());
    }
  }
  const levelOf = new Map((input.methodGestures ?? []).map((g) => [norm(g.name), g.passport_level ?? null]));
  const gestures: PassportGesture[] = [...timeline.entries()].map(([k, { name, scores }]) => {
    const last = scores[scores.length - 1];
    return { name, state: gestureState(last), last, sinceFirst: scores.length > 1 ? last - scores[0] : null, level: levelOf.get(k) ?? null };
  });
  // Geste signalé difficile à la dernière pratique sans note : à travailler.
  for (const k of flagged) if (!timeline.has(k)) gestures.push({ name: flaggedNames.get(k)!, state: "a-travailler", last: null, sinceFirst: null, level: levelOf.get(k) ?? null });
  gestures.sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return { level, next, tests, gestures, empty: !tests.length && !gestures.length };
}

export const levelLabel = (l: PassportLevel | null) => (l ? LEVEL_LABEL[l] : null);

/** Référence de la tâche de JP pour une demande de rencontre fille-parent-coach (une seule ouverte à la fois). */
export const parcoursRef = (registrationId: string) => `parcours:${registrationId}`;
