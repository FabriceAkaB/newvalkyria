/** Passeport et tests de progression (Mandalart P1.2, P1.5.03) : règles pures, sans base de données.
 *  Chaque fille est comparée à elle-même (son test précédent, son jour 1), jamais aux autres. */

export const PASSPORT_LEVELS = ["bronze", "argent", "or", "mauve"] as const;
export type PassportLevel = (typeof PASSPORT_LEVELS)[number];
export const LEVEL_LABEL: Record<PassportLevel, string> = { bronze: "Bronze", argent: "Argent", or: "Or", mauve: "Mauve" };

export const TEST_CONTEXTS = ["jour-1", "mensuel", "fin-de-saison", "autre"] as const;
export type TestContext = (typeof TEST_CONTEXTS)[number];
export const CONTEXT_LABEL: Record<TestContext, string> = { "jour-1": "Jour 1", mensuel: "Test du mois", "fin-de-saison": "Fin de saison", autre: "Autre" };

export interface SkillTest {
  id: string;
  name: string;
  gesture: string | null;
  unit: string;
  higher_is_better: boolean;
  duration_seconds: number | null;
  protocol: string | null;
  thresholds: Partial<Record<PassportLevel, number>>;
  sort_order: number;
  active: boolean;
  validated_at: string | null;
}

export interface TestResult {
  id?: string;
  test_id: string;
  registration_id: string;
  tested_on: string;
  context: TestContext;
  score: number;
  video_url: string | null;
  note?: string | null;
}

/** Meilleur score des deux : le plus haut, ou le plus bas pour un chrono. */
const better = (test: Pick<SkillTest, "higher_is_better">, a: number, b: number) => (test.higher_is_better ? a >= b : a <= b);

/** Niveau du passeport atteint par un score (null si aucun seuil n'est fixé ou atteint). */
export function levelFor(test: Pick<SkillTest, "thresholds" | "higher_is_better">, score: number): PassportLevel | null {
  let reached: PassportLevel | null = null;
  for (const level of PASSPORT_LEVELS) {
    const t = test.thresholds?.[level];
    if (t === undefined || t === null || Number.isNaN(Number(t))) continue;
    if (better(test, score, Number(t))) reached = level;
  }
  return reached;
}

export interface TestProgress {
  testId: string;
  first: TestResult;
  last: TestResult;
  previous: TestResult | null;
  /** Écart avec le test précédent, dans le sens « mieux » (positif = progrès, même pour un chrono). */
  sincePrevious: number | null;
  /** Écart avec le premier test (le jour 1 en général), dans le sens « mieux ». */
  sinceFirst: number | null;
  best: number;
  level: PassportLevel | null;
  count: number;
}

const round = (n: number) => Math.round(n * 10) / 10;
const gain = (test: Pick<SkillTest, "higher_is_better">, from: number, to: number) => round(test.higher_is_better ? to - from : from - to);

/** Progression d'une joueuse à un test, à partir de tous ses résultats (n'importe quel ordre). */
export function progressFor(test: SkillTest, results: TestResult[]): TestProgress | null {
  const list = results.filter((r) => r.test_id === test.id).sort((a, b) => a.tested_on.localeCompare(b.tested_on) || (a.context === "jour-1" ? -1 : 1));
  if (!list.length) return null;
  const first = list[0];
  const last = list[list.length - 1];
  const previous = list.length > 1 ? list[list.length - 2] : null;
  const best = list.reduce((b, r) => (better(test, Number(r.score), b) ? Number(r.score) : b), Number(first.score));
  return {
    testId: test.id,
    first,
    last,
    previous,
    sincePrevious: previous ? gain(test, Number(previous.score), Number(last.score)) : null,
    sinceFirst: list.length > 1 ? gain(test, Number(first.score), Number(last.score)) : null,
    best,
    level: levelFor(test, Number(last.score)),
    count: list.length
  };
}

/** Écart affiché : « +6 touches », « −1,2 secondes » devient « 1,2 s plus vite »… toujours du point de vue du progrès. */
export function formatGain(test: Pick<SkillTest, "unit" | "higher_is_better">, value: number | null): string {
  if (value === null) return "—";
  const n = Math.abs(value).toLocaleString("fr-CA", { maximumFractionDigits: 1 });
  if (value === 0) return "Pareil";
  if (!test.higher_is_better && test.unit === "secondes") return value > 0 ? `${n} s plus vite` : `${n} s plus lent`;
  return `${value > 0 ? "+" : "−"}${n} ${test.unit}`;
}

/** Convention de nom des vidéos (P1.2.04) : Prénom-Nom_geste_AAAA-MM-JJ_type. Sans accents ni espaces. */
export function videoFileName(firstName: string, lastName: string, gesture: string, date: string, type: "test" | "maison" | "demo" = "test"): string {
  const clean = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .trim()
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const cap = (s: string) => clean(s).split("-").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("-");
  return `${cap(firstName)}-${cap(lastName)}_${clean(gesture).toLowerCase()}_${date}_${type}`;
}

/** Indicateur joueuses_filmees_jour1 : part des joueuses actives qui ont au moins un test « jour 1 » filmé. */
export function jour1Coverage(registrationIds: string[], results: Pick<TestResult, "registration_id" | "context" | "video_url">[]): { filmed: number; tested: number; total: number; percent: number | null } {
  const ids = new Set(registrationIds);
  const tested = new Set(results.filter((r) => r.context === "jour-1" && ids.has(r.registration_id)).map((r) => r.registration_id));
  const filmed = new Set(results.filter((r) => r.context === "jour-1" && r.video_url && ids.has(r.registration_id)).map((r) => r.registration_id));
  return { filmed: filmed.size, tested: tested.size, total: ids.size, percent: ids.size ? Math.round((filmed.size / ids.size) * 1000) / 10 : null };
}

/** Lit un score saisi au bord du terrain (« 42 », « 12,5 »). null si vide, NaN si illisible. */
export function parseScore(raw: unknown): number | null {
  if (raw === null || raw === undefined || String(raw).trim() === "") return null;
  const n = Number(String(raw).replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(n) && n >= 0 && n < 10000 ? n : NaN;
}
