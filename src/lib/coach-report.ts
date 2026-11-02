/** Rapport de l'éducateur après chaque activité (Mandalart P1.2.08, P1.4.09, P1.5.06, P8.3.04) :
 *  règles pures, partagées entre le portail entraîneur, la paie et « Aujourd'hui ».
 *  - Évaluation rapide d'une joueuse : 3 échelles de 1 à 5 + une note d'au moins 30 caractères.
 *  - Contrôle de qualité : note trop courte, qui se répète, copiée d'une autre fille ou d'une séance précédente = refusée.
 *  - Les heures d'une activité ne comptent pour la paie que si la présence de l'éducateur est confirmée
 *    et le rapport complet (présences de toutes les joueuses + évaluation de chaque fille présente). */

export const QUICK_CRITERIA = ["Ball mastery", "Prestation", "Attitude"] as const;
export type QuickCriterion = (typeof QUICK_CRITERIA)[number];

export const QUICK_SCALE: { value: number; label: string }[] = [
  { value: 1, label: "À travailler" },
  { value: 2, label: "Fragile" },
  { value: 3, label: "Correct" },
  { value: 4, label: "Bien" },
  { value: 5, label: "Excellent" }
];

export const NOTE_MIN_CHARS = 30;

/** La règle « rapport complet avant que les heures comptent » s'applique aux activités à partir de cette date ;
 *  les activités plus anciennes gardent l'ancienne règle (présence = heures payées). */
export const REPORT_RULE_START = "2026-11-02";

/** Types d'activité où l'éducateur remplit un rapport sur les joueuses (les matchs ont leur propre panneau). */
export const REPORT_REQUIRED_TYPES = ["Pratique", "Camp"];

/** Statuts de présence où la joueuse a participé : elle doit être évaluée et donner sa note de fin. */
export const PARTICIPATED = ["present", "late", "left_early"];

/* ── Notes ─────────────────────────────────────────────────────────── */

export const cleanNote = (s: string | null | undefined) => String(s ?? "").replace(/\s+/g, " ").trim();

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Mots significatifs d'une note (sans les prénoms donnés, sans les mots de 1 ou 2 lettres). */
function words(note: string, names: string[] = []): string[] {
  const skip = new Set(names.flatMap((n) => normalize(n).split(" ")).filter(Boolean));
  return normalize(note)
    .split(" ")
    .filter((w) => w.length > 2 && !skip.has(w));
}

/** Ressemblance entre deux notes, de 0 à 1 (coefficient de Dice sur les mots, prénoms retirés). */
export function noteSimilarity(a: string, b: string, names: string[] = []): number {
  const wa = words(a, names);
  const wb = words(b, names);
  if (!wa.length || !wb.length) return normalize(a) === normalize(b) ? 1 : 0;
  const counts = new Map<string, number>();
  for (const w of wa) counts.set(w, (counts.get(w) ?? 0) + 1);
  let common = 0;
  for (const w of wb) {
    const n = counts.get(w) ?? 0;
    if (n > 0) {
      common += 1;
      counts.set(w, n - 1);
    }
  }
  return (2 * common) / (wa.length + wb.length);
}

export const SAME_ACTIVITY_LIMIT = 0.8;
export const PREVIOUS_SESSION_LIMIT = 0.9;

export interface NoteToCompare {
  playerName: string;
  note: string;
  /** Date de l'activité (AAAA-MM-JJ), pour les notes des séances précédentes. */
  date?: string;
}

export interface NoteCheck {
  ok: boolean;
  code?: "trop-court" | "repetitif" | "autre-joueuse" | "seance-precedente";
  message?: string;
}

/** Élision devant une voyelle : « celle d'Alexia », « qu'Alexia ». */
const startsWithVowel = (name: string) => /^[aeiouyhàâéèêëîïôûü]/i.test(name.trim());
const de = (name: string) => (startsWithVowel(name) ? `d'${name}` : `de ${name}`);
const que = (name: string) => (startsWithVowel(name) ? `qu'${name}` : `que ${name}`);

const dateFr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "long" });

/** Vérifie une note avant de l'enregistrer. Les messages s'adressent à l'éducateur, en mots simples. */
export function checkNote(input: {
  note: string;
  playerFirstName: string;
  /** Notes déjà écrites pour les autres filles de la même activité. */
  sameActivity: NoteToCompare[];
  /** Notes écrites par le même éducateur dans les séances précédentes (toutes joueuses). */
  previous: NoteToCompare[];
}): NoteCheck {
  const note = cleanNote(input.note);
  const first = input.playerFirstName.trim() || "la joueuse";
  if (note.length < NOTE_MIN_CHARS) {
    const left = NOTE_MIN_CHARS - note.length;
    return {
      ok: false,
      code: "trop-court",
      message: `Encore ${left} caractère${left > 1 ? "s" : ""} : écris comment ${first} s'est sentie et comment elle s'est comportée aujourd'hui.`
    };
  }

  const w = words(note);
  const distinct = new Set(w).size;
  if (/(.)\1{5,}/i.test(note.replace(/\s/g, "")) || distinct < 4 || (w.length >= 6 && distinct / w.length < 0.5)) {
    return { ok: false, code: "repetitif", message: `Cette note se répète. Décris en tes mots ce que ${first} a vécu aujourd'hui.` };
  }

  const names = (other: string) => [input.playerFirstName, other];
  for (const other of input.sameActivity) {
    if (noteSimilarity(note, other.note, names(other.playerName)) >= SAME_ACTIVITY_LIMIT) {
      return {
        ok: false,
        code: "autre-joueuse",
        message: `Cette note ressemble trop à celle ${de(other.playerName)}. Chaque fille a sa propre note : qu'est-ce ${que(first)} a fait de différent ?`
      };
    }
  }
  for (const old of input.previous) {
    if (noteSimilarity(note, old.note, names(old.playerName)) >= PREVIOUS_SESSION_LIMIT) {
      return {
        ok: false,
        code: "seance-precedente",
        message: `Tu as déjà écrit cette note${old.date ? ` le ${dateFr(old.date)}` : ""} (pour ${old.playerName}). Écris ce que tu as vu aujourd'hui.`
      };
    }
  }
  return { ok: true };
}

/** Une évaluation rapide est complète quand les 3 échelles sont notées et la note fait au moins 30 caractères. */
export function isQuickEvaluationComplete(ev: { ratings?: Record<string, number> | null; comment?: string | null } | null | undefined): boolean {
  if (!ev) return false;
  const r = ev.ratings ?? {};
  return QUICK_CRITERIA.every((c) => Number(r[c]) >= 1 && Number(r[c]) <= 5) && cleanNote(ev.comment).length >= NOTE_MIN_CHARS;
}

/* ── Rapport d'une activité ─────────────────────────────────────────── */

export interface ReportPlayer {
  registrationId: string;
  name: string;
}

export interface ReportAttendance {
  registration_id: string;
  status: string;
  practice_rating?: number | null;
  fatigue?: number | null;
}

export interface ReportEvaluation {
  registration_id: string;
  ratings?: Record<string, number> | null;
  comment?: string | null;
}

export interface ReportStatus {
  /** Un rapport sur les joueuses est demandé pour cette activité. */
  required: boolean;
  expected: number;
  participated: number;
  attendanceMissing: string[];
  evaluationsMissing: string[];
  feedbackMissing: string[];
  /** Présences + évaluations complètes (ce qui compte pour la paie). */
  complete: boolean;
}

export function reportRequired(activity: { activity_type: string; organization?: string | null }, rosterSize: number): boolean {
  return REPORT_REQUIRED_TYPES.includes(activity.activity_type) && !activity.organization && rosterSize > 0;
}

export function computeReport(input: {
  activity: { activity_type: string; organization?: string | null };
  roster: ReportPlayer[];
  attendance: ReportAttendance[];
  evaluations: ReportEvaluation[];
}): ReportStatus {
  const required = reportRequired(input.activity, input.roster.length);
  const att = new Map(input.attendance.map((a) => [a.registration_id, a]));
  const evaluated = new Set(input.evaluations.filter(isQuickEvaluationComplete).map((e) => e.registration_id));
  const attendanceMissing: string[] = [];
  const evaluationsMissing: string[] = [];
  const feedbackMissing: string[] = [];
  let participated = 0;
  for (const p of input.roster) {
    const a = att.get(p.registrationId);
    if (!a) {
      attendanceMissing.push(p.name);
      continue;
    }
    if (!PARTICIPATED.includes(a.status)) continue;
    participated += 1;
    if (!evaluated.has(p.registrationId)) evaluationsMissing.push(p.name);
    if (a.practice_rating == null || a.fatigue == null) feedbackMissing.push(p.name);
  }
  return {
    required,
    expected: input.roster.length,
    participated,
    attendanceMissing,
    evaluationsMissing,
    feedbackMissing,
    complete: !required || (attendanceMissing.length === 0 && evaluationsMissing.length === 0)
  };
}

/* ── Paie : les heures comptent-elles ? ─────────────────────────────── */

export type PayHold = "presence" | "rapport";

export const PAY_HOLD_LABEL: Record<PayHold, string> = {
  presence: "Présence de l'éducateur pas confirmée",
  rapport: "Rapport incomplet (présences ou évaluations)"
};

/** Raison pour laquelle les heures d'une assignation ne comptent pas encore, ou null si elles comptent. */
export function payHold(input: { activityDate: string; status: string; confirmed: boolean; report: Pick<ReportStatus, "required" | "complete"> | null }): PayHold | null {
  if (input.activityDate < REPORT_RULE_START || input.status !== "present") return null;
  if (!input.confirmed) return "presence";
  if (input.report && input.report.required && !input.report.complete) return "rapport";
  return null;
}

/** Une date et une heure de Montréal (« 2026-11-09 », « 19:25 ») en millisecondes : début ou fin d'une activité,
 *  pour la relance à 24 h et l'étape ouverte par défaut dans le portail. */
export function activityEndMs(date: string, endTime: string): number {
  const [h, m] = endTime.split(":").map((n) => parseInt(n, 10));
  // Décalage de Montréal ce jour-là : midi UTC donne 07 h l'hiver (UTC-5), 08 h l'été (UTC-4).
  const base = Date.parse(`${date}T00:00:00Z`);
  const offsetH = new Date(`${date}T12:00:00Z`).toLocaleString("en-US", { timeZone: "America/Toronto", hour: "2-digit", hour12: false }) === "07" ? 5 : 4;
  return base + ((h + offsetH) * 60 + (m || 0)) * 60000;
}

/** Résumé d'une semaine de routines de fin (note de la pratique et fatigue, sur 10). */
export interface FeedbackWeek {
  weekStart: string;
  count: number;
  rating: number | null;
  fatigue: number | null;
}

const mondayOf = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 86400000).toISOString().slice(0, 10);
};

export function feedbackByWeek(rows: { date: string; practice_rating: number | null; fatigue: number | null }[]): FeedbackWeek[] {
  const weeks = new Map<string, { n: number; r: number; rn: number; f: number; fn: number }>();
  for (const row of rows) {
    if (row.practice_rating == null && row.fatigue == null) continue;
    const k = mondayOf(row.date);
    const w = weeks.get(k) ?? { n: 0, r: 0, rn: 0, f: 0, fn: 0 };
    w.n += 1;
    if (row.practice_rating != null) {
      w.r += row.practice_rating;
      w.rn += 1;
    }
    if (row.fatigue != null) {
      w.f += row.fatigue;
      w.fn += 1;
    }
    weeks.set(k, w);
  }
  const round = (n: number) => Math.round(n * 10) / 10;
  return [...weeks.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([weekStart, w]) => ({ weekStart, count: w.n, rating: w.rn ? round(w.r / w.rn) : null, fatigue: w.fn ? round(w.f / w.fn) : null }));
}

export const montrealTimeMs = activityEndMs;

/** Étape du portail ouverte par défaut selon l'heure : avant, pendant ou après l'activité. */
export function defaultStepFor(date: string, startTime: string, endTime: string, now: number = Date.now()): "avant" | "pendant" | "apres" {
  if (now < activityEndMs(date, startTime) - 15 * 60000) return "avant";
  if (now <= activityEndMs(date, endTime) - 10 * 60000) return "pendant";
  return "apres";
}

/** L'activité a-t-elle commencé ? (heure de Montréal) */
export const hasStarted = (date: string, startTime: string, now: number = Date.now()) => activityEndMs(date, startTime) <= now;

/* ── Espace coaching : joueuses à surveiller ────────────────────────── */

export interface WatchInput {
  /** Évaluations rapides, de la plus ancienne à la plus récente. */
  evaluations: { date: string; ratings: Record<string, number> | null }[];
  /** Routine de fin, de la plus ancienne à la plus récente. */
  feedback: { date: string; practice_rating: number | null; fatigue: number | null }[];
}

/** Pourquoi suivre une joueuse de près (dernières pratiques) : attitude ou prestation basses, fatigue élevée,
 *  pratique mal notée par elle-même, ou une échelle en baisse nette. Liste vide = rien à signaler. */
export function watchReasons({ evaluations, feedback }: WatchInput): string[] {
  const reasons: string[] = [];
  const recent = evaluations.slice(-3);
  const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null);
  const avgOf = (list: typeof evaluations, c: string) => avg(list.map((e) => Number(e.ratings?.[c])).filter((v) => v >= 1 && v <= 5));
  for (const c of ["Attitude", "Prestation"]) {
    const a = avgOf(recent, c);
    if (recent.length >= 2 && a !== null && a <= 2) reasons.push(`${c} basse aux dernières pratiques (${a.toLocaleString("fr-CA", { maximumFractionDigits: 1 })}/5)`);
  }
  if (evaluations.length >= 6) {
    for (const c of QUICK_CRITERIA) {
      const before = avgOf(evaluations.slice(-6, -3), c);
      const now = avgOf(recent, c);
      if (before !== null && now !== null && before - now >= 1) reasons.push(`${c} en baisse (${before.toFixed(1)} → ${now.toFixed(1)})`.replace(/\./g, ","));
    }
  }
  const lastFb = feedback.filter((f) => f.practice_rating != null || f.fatigue != null).slice(-2);
  if (lastFb.length && lastFb.every((f) => (f.fatigue ?? 0) >= 8)) reasons.push(`Très fatiguée (${lastFb.map((f) => f.fatigue).join(", ")}/10)`);
  if (lastFb.length && lastFb.every((f) => f.practice_rating != null && f.practice_rating <= 5)) reasons.push(`N'aime pas les pratiques en ce moment (${lastFb.map((f) => f.practice_rating).join(", ")}/10)`);
  return reasons;
}
