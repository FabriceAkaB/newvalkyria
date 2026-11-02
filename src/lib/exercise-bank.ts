/** Banque d'exercices Valkyria : règles pures (sans base de données), partagées par l'admin,
 *  le portail entraîneur et le Mandalart. Mandalart P1.3.12 à P1.3.17.
 *
 *  Règle d'approbation (JP, 2 nov. 2026) : un exercice est « à tester » au départ ; il est
 *  approuvé quand 2 éducateurs différents lui donnent 8 sur 10 ou plus et que JP le valide.
 *  Une note sous 8 = l'exercice est « à changer » : on en fait une nouvelle version (les notes
 *  repartent à zéro), il ne revient pas dans une séance la même semaine, puis on le réévalue.
 *  Il est retiré si la moyenne de ses 2 dernières notes (version en cours et précédente) reste sous 6. */

/** Geste ou thème de l'exercice (colonne `category`). */
export const EXERCISE_CATEGORIES = [
  "Ball mastery", "Contrôle", "Passe", "Conduite", "1v1", "Finition", "Prise de décision", "Transition", "Jeu entre les lignes", "Prise d'information", "Défense", "Physique", "Autre"
] as const;

export const EXERCISE_LEVELS = ["Développement", "Avancé", "Tous niveaux"] as const;

export const EXERCISE_TYPES = [
  { key: "echauffement", label: "Échauffement" },
  { key: "ball-mastery", label: "Ball mastery" },
  { key: "analytique", label: "Analytique (technique)" },
  { key: "jeu-reduit", label: "Jeu réduit à thème" },
  { key: "forme-jouee", label: "Forme jouée" },
  { key: "physique", label: "Physique" }
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number]["key"];

export const SESSION_PLACES = [
  { key: "jeu-entree", label: "Jeu d'entrée" },
  { key: "ball-mastery", label: "Ball mastery" },
  { key: "technique", label: "Technique" },
  { key: "forme-jouee", label: "Forme jouée" }
] as const;
export type SessionPlace = (typeof SESSION_PLACES)[number]["key"];

export const VENUES = [
  { key: "gymnase", label: "Gymnase" },
  { key: "synthetique", label: "Synthétique" },
  { key: "les-deux", label: "Gymnase ou synthétique" }
] as const;
export type Venue = (typeof VENUES)[number]["key"];

export const AGE_GROUPS = ["U7", "U8", "U9", "U10", "U11", "U12", "U13", "U14+"] as const;

/** Organisation selon le nombre de joueuses (P1.3.14). */
export const SIZE_BANDS = [
  { key: "setup_5_7", label: "5 à 7 joueuses", min: 5, max: 7 },
  { key: "setup_8_10", label: "8 à 10 joueuses", min: 8, max: 10 },
  { key: "setup_11_16", label: "11 à 16 joueuses", min: 11, max: 16 }
] as const;
export type SizeBandKey = (typeof SIZE_BANDS)[number]["key"];

export const MATERIAL_SUGGESTIONS = ["1 ballon par fille", "Cônes", "Dossards bicolores", "Mini-buts", "Buts", "Coupelles", "Échelle de rythme"];

export const typeLabel = (k: string | null | undefined) => EXERCISE_TYPES.find((t) => t.key === k)?.label ?? null;
export const placeLabel = (k: string | null | undefined) => SESSION_PLACES.find((t) => t.key === k)?.label ?? null;
export const venueLabel = (k: string | null | undefined) => VENUES.find((t) => t.key === k)?.label ?? null;

/** Place dans la séance proposée par défaut selon le type. */
export const DEFAULT_PLACE: Partial<Record<ExerciseType, SessionPlace>> = {
  echauffement: "jeu-entree",
  "ball-mastery": "ball-mastery",
  analytique: "technique",
  "jeu-reduit": "forme-jouee",
  "forme-jouee": "forme-jouee"
};

const DECISION_THEMES = ["prise de decision", "transition", "jeu entre les lignes", "prise d'information"];
const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Lieu conseillé (P1.3.17) : gymnase = technique et ball mastery ; synthétique = tactique,
 *  grand espace et prise de décision. */
export function recommendedVenue(type: string | null | undefined, theme: string | null | undefined): { venue: Venue; why: string } | null {
  if (theme && DECISION_THEMES.includes(norm(theme))) return { venue: "synthetique", why: "prise de décision et grand espace : synthétique" };
  if (type === "ball-mastery" || type === "analytique") return { venue: "gymnase", why: "technique et ball mastery : gymnase" };
  if (type === "jeu-reduit" || type === "forme-jouee") return { venue: "synthetique", why: "tactique, grand espace et prise de décision : synthétique" };
  return null;
}

/* ── Fiche et liste de vérification Valkyria (P1.3.13) ─────────────────────────────── */

/** Champs de la fiche utilisés par les règles (sous-ensemble de la ligne `exercises`). */
export interface ExerciseSheetFields {
  title: string;
  objective: string | null;
  category: string | null;
  exercise_type: string | null;
  session_place: string | null;
  age_groups: string[] | null;
  level: string | null;
  min_players: number | null;
  max_players: number | null;
  venue: string | null;
  duration_minutes: number | null;
  material: string | null;
  instructions: string | null;
  coaching_points: string | null;
  setup_5_7: string | null;
  setup_8_10: string | null;
  setup_11_16: string | null;
  variant_easier: string | null;
  variant_harder: string | null;
  variant_cognitive: string | null;
  progression: string | null;
  physical_metrics: string | null;
  image_url: string | null;
  video_url: string | null;
  diagram_data: unknown;
  author: string | null;
}

export interface ChecklistItem {
  key: string;
  label: string;
  ok: boolean;
}

const filled = (s: string | null | undefined) => Boolean(s && s.trim().length > 0);

/** Tranches de nombre de joueuses qui concernent l'exercice (selon son minimum et son maximum). */
export function applicableBands(min: number | null, max: number | null) {
  const lo = min ?? SIZE_BANDS[0].min;
  const hi = max ?? SIZE_BANDS[SIZE_BANDS.length - 1].max;
  const bands = SIZE_BANDS.filter((b) => b.max >= lo && b.min <= hi);
  return bands.length ? bands : [...SIZE_BANDS];
}

export function checklist(e: ExerciseSheetFields): ChecklistItem[] {
  const bands = applicableBands(e.min_players, e.max_players);
  const items: ChecklistItem[] = [
    { key: "type", label: "Type d'exercice", ok: filled(e.exercise_type) },
    { key: "objective", label: "Objectif", ok: filled(e.objective) },
    { key: "theme", label: "Geste ou thème", ok: filled(e.category) },
    { key: "place", label: "Place dans la séance", ok: filled(e.session_place) },
    { key: "ages", label: "Âge ou génération", ok: (e.age_groups ?? []).length > 0 },
    { key: "level", label: "Niveau", ok: filled(e.level) },
    { key: "players", label: "Joueuses minimum et maximum", ok: e.min_players !== null && e.max_players !== null },
    { key: "setups", label: `Organisation selon le nombre (${bands.map((b) => b.label.replace(" joueuses", "")).join(", ")})`, ok: bands.every((b) => filled(e[b.key])) },
    { key: "venue", label: "Lieu (gymnase ou synthétique)", ok: filled(e.venue) },
    { key: "duration", label: "Durée", ok: e.duration_minutes !== null && e.duration_minutes > 0 },
    { key: "material", label: "Matériel", ok: filled(e.material) },
    { key: "instructions", label: "Déroulement", ok: filled(e.instructions) },
    { key: "coaching", label: "Consignes clés", ok: filled(e.coaching_points) },
    { key: "easier", label: "Variante plus facile", ok: filled(e.variant_easier) },
    { key: "harder", label: "Variante plus difficile", ok: filled(e.variant_harder) },
    { key: "cognitive", label: "Variante cognitive", ok: filled(e.variant_cognitive) },
    { key: "progression", label: "Progression", ok: filled(e.progression) }
  ];
  if (e.exercise_type === "physique") items.push({ key: "metrics", label: "Métriques (exercice physique)", ok: filled(e.physical_metrics) });
  items.push({ key: "media", label: "Schéma, photo ou vidéo", ok: Boolean(e.diagram_data) || filled(e.image_url) || filled(e.video_url) });
  items.push({ key: "author", label: "Auteur", ok: filled(e.author) });
  return items;
}

export function checklistSummary(e: ExerciseSheetFields) {
  const items = checklist(e);
  const missing = items.filter((i) => !i.ok);
  return { items, done: items.length - missing.length, total: items.length, missing, complete: missing.length === 0 };
}

/* ── Évaluation sur 10 par les éducateurs (P1.3.02, P1.3.15) ─────────────────────────── */

export const RATING_CRITERIA = [
  { key: "engagement", label: "Engagement et plaisir", short: "Engagement" },
  { key: "touches", label: "Volume de touches, sans file d'attente", short: "Touches" },
  { key: "objectif", label: "Objectif atteint", short: "Objectif" },
  { key: "adapte", label: "Adapté à l'âge et au nombre", short: "Adapté" },
  { key: "explication", label: "Expliqué et organisé en moins de 2 minutes", short: "Explication" }
] as const;
export type RatingCriterion = (typeof RATING_CRITERIA)[number]["key"];
export type RatingScores = Record<RatingCriterion, 0 | 1 | 2>;
export const SCORE_LABELS = ["Non", "En partie", "Oui"] as const;

export const APPROVAL_SCORE = 8;
export const RETIRE_AVERAGE = 6;
export const APPROVAL_COACHES = 2;

/** Valide les 5 critères (0, 1 ou 2 chacun) et retourne le total sur 10, ou null si incomplet. */
export function parseScores(input: unknown): { scores: RatingScores; total: number } | null {
  if (!input || typeof input !== "object") return null;
  const scores = {} as RatingScores;
  let total = 0;
  for (const c of RATING_CRITERIA) {
    const v = (input as Record<string, unknown>)[c.key];
    if (v !== 0 && v !== 1 && v !== 2) return null;
    scores[c.key] = v;
    total += v;
  }
  return { scores, total };
}

export interface RatingLite {
  exercise_version: number;
  total: number;
  coach_id: string | null;
  activity_date: string | null;
  created_at: string;
}

export type BankStatus = "a-tester" | "a-valider" | "approuve" | "a-changer" | "retire";

export const STATUS_LABEL: Record<BankStatus, string> = {
  approuve: "Approuvé",
  "a-valider": "À valider par JP",
  "a-tester": "À tester",
  "a-changer": "À changer",
  retire: "Retiré"
};
export const STATUS_TONE: Record<BankStatus, "good" | "warn" | "bad" | "info" | "accent" | undefined> = {
  approuve: "good",
  "a-valider": "accent",
  "a-tester": "info",
  "a-changer": "warn",
  retire: "bad"
};
const STATUS_RANK: Record<BankStatus, number> = { approuve: 0, "a-valider": 1, "a-tester": 2, "a-changer": 3, retire: 4 };

export interface BankSummary {
  status: BankStatus;
  /** Phrase qui explique le statut, du point de vue de JP. */
  reason: string;
  /** Moyenne sur 10 de la version en cours (null si aucune note). */
  average: number | null;
  /** Nombre de notes de la version en cours. */
  count: number;
  /** Nombre total de notes, toutes versions. */
  countAll: number;
  /** Éducateurs différents qui ont donné 8 ou plus à la version en cours. */
  coachesAtApproval: number;
  /** Date de séance de la dernière note sous 8 (règle « pas la même semaine »). */
  lastLowDate: string | null;
  top: boolean;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const byDate = (a: RatingLite, b: RatingLite) => (a.activity_date ?? a.created_at.slice(0, 10)).localeCompare(b.activity_date ?? b.created_at.slice(0, 10)) || a.created_at.localeCompare(b.created_at);
export const fmtScore = (n: number | null) => (n === null ? "—" : n.toLocaleString("fr-CA", { minimumFractionDigits: n % 1 ? 1 : 0, maximumFractionDigits: 1 }));

export function computeBankStatus(ex: { version: number; validated_version: number | null; retired_at: string | null }, ratings: RatingLite[]): BankSummary {
  const sorted = [...ratings].sort(byDate);
  const current = sorted.filter((r) => r.exercise_version === ex.version);
  const average = avg(current.map((r) => r.total));
  const coachesAtApproval = new Set(current.filter((r) => r.total >= APPROVAL_SCORE).map((r) => r.coach_id ?? "?")).size;
  const lows = sorted.filter((r) => r.total < APPROVAL_SCORE);
  const lastLowDate = lows.length ? (lows[lows.length - 1].activity_date ?? lows[lows.length - 1].created_at.slice(0, 10)) : null;
  const base = { average, count: current.length, countAll: sorted.length, coachesAtApproval, lastLowDate, top: false };

  if (ex.retired_at) return { ...base, status: "retire", reason: "Retiré de la banque par JP." };

  // Retiré : la dernière note (version en cours) est encore sous 8 et la moyenne des 2 dernières
  // (version en cours et précédente) reste sous 6. Une nouvelle version sans note repart « à tester ».
  const recent = sorted.filter((r) => r.exercise_version >= ex.version - 1).slice(-2);
  const recentAvg = avg(recent.map((r) => r.total));
  const latest = recent[recent.length - 1];
  const currentLow = current.find((r) => r.total < APPROVAL_SCORE);
  if (recent.length === 2 && recentAvg !== null && recentAvg < RETIRE_AVERAGE && latest.exercise_version === ex.version && latest.total < APPROVAL_SCORE) {
    return { ...base, status: "retire", reason: `Retiré : la moyenne des 2 dernières notes est ${fmtScore(recentAvg)} sur 10 (sous ${RETIRE_AVERAGE}).` };
  }
  if (currentLow) {
    return { ...base, status: "a-changer", reason: `Une note de ${currentLow.total} sur 10 (sous ${APPROVAL_SCORE}) : faire une nouvelle version ; il ne revient pas dans une séance la même semaine.` };
  }
  if (coachesAtApproval >= APPROVAL_COACHES) {
    if (ex.validated_version === ex.version) {
      return { ...base, status: "approuve", reason: `${coachesAtApproval} éducateurs ont donné ${APPROVAL_SCORE} ou plus et JP a validé la version ${ex.version}.`, top: (average ?? 0) >= 9 };
    }
    return { ...base, status: "a-valider", reason: `${coachesAtApproval} éducateurs ont donné ${APPROVAL_SCORE} ou plus : il reste la validation de JP.` };
  }
  const left = APPROVAL_COACHES - coachesAtApproval;
  return {
    ...base,
    status: "a-tester",
    reason: current.length
      ? `Encore ${left} éducateur${left > 1 ? "s" : ""} différent${left > 1 ? "s" : ""} à ${APPROVAL_SCORE} ou plus pour l'approuver.`
      : ex.version > 1
        ? `Nouvelle version ${ex.version} : les notes repartent à zéro, à réévaluer.`
        : "Pas encore noté : à essayer en séance."
  };
}

/* ── Utilisation en séance : « pas la même semaine » ──────────────────────────────── */

/** Dimanche de la semaine d'une date AAAA-MM-JJ (même découpage que la page Pratiques). */
export function weekStartOf(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

/** Peut-on mettre cet exercice dans une séance à cette date ? */
export function planningAvailability(summary: BankSummary, ratings: RatingLite[], activityDate: string): { ok: true } | { ok: false; reason: string } {
  if (summary.status === "retire") return { ok: false, reason: "Cet exercice est retiré de la banque." };
  if (summary.status === "a-changer") return { ok: false, reason: "Cet exercice est « à changer » : JP doit d'abord en faire une nouvelle version." };
  const week = weekStartOf(activityDate);
  const lowSameWeek = ratings.some((r) => r.total < APPROVAL_SCORE && weekStartOf(r.activity_date ?? r.created_at) === week);
  if (lowSameWeek) return { ok: false, reason: "Cet exercice a été noté sous 8 cette semaine : pas avant la semaine prochaine." };
  return { ok: true };
}

/* ── Recherche et tri (« top exercices » d'abord) ─────────────────────────────────── */

export interface BankFilters {
  q?: string;
  type?: string;
  theme?: string;
  age?: string;
  venue?: string;
  place?: string;
  players?: number | null;
  status?: BankStatus | "";
  minScore?: number | null;
}

export interface BankEntryLike {
  title: string;
  category: string | null;
  exercise_type: string | null;
  session_place: string | null;
  age_groups: string[] | null;
  venue: string | null;
  min_players: number | null;
  max_players: number | null;
  objective: string | null;
  bank: BankSummary;
}

export function matchesFilters(e: BankEntryLike, f: BankFilters): boolean {
  if (f.q && !norm(`${e.title} ${e.objective ?? ""} ${e.category ?? ""}`).includes(norm(f.q))) return false;
  if (f.type && e.exercise_type !== f.type) return false;
  if (f.theme && norm(e.category) !== norm(f.theme)) return false;
  if (f.age && !(e.age_groups ?? []).includes(f.age)) return false;
  if (f.venue && e.venue !== f.venue && e.venue !== "les-deux") return false;
  if (f.place && e.session_place !== f.place) return false;
  if (f.players) {
    if ((e.min_players ?? 0) > f.players || (e.max_players ?? 99) < f.players) return false;
  }
  if (f.status && e.bank.status !== f.status) return false;
  if (f.minScore && (e.bank.average ?? -1) < f.minScore) return false;
  return true;
}

/** Approuvés d'abord, puis par note moyenne, puis par nombre de notes. */
export function compareBank(a: BankEntryLike, b: BankEntryLike): number {
  return (
    STATUS_RANK[a.bank.status] - STATUS_RANK[b.bank.status] ||
    (b.bank.average ?? -1) - (a.bank.average ?? -1) ||
    b.bank.count - a.bank.count ||
    a.title.localeCompare(b.title, "fr")
  );
}

/** Libellé d'un exercice dans la liste du plan de séance (portail entraîneur et admin). */
export function planningLabel(e: { title: string; bank?: BankSummary }): string {
  const s = e.bank;
  if (!s) return e.title;
  if (s.status === "approuve") return `${s.top ? "★ " : ""}${e.title} · approuvé ${fmtScore(s.average)}/10`;
  if (s.status === "a-valider") return `${e.title} · ${fmtScore(s.average)}/10`;
  return `${e.title} · ${STATUS_LABEL[s.status].toLowerCase()}`;
}
