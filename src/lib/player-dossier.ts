/** Dossier complet d'une joueuse dans l'Espace Technique (JP, 26 nov. 2026) : « un endroit avec toutes les joueuses,
 *  où tous les rapports, les sondages et toutes les infos qui la concernent sont réunis, comme ça on voit tout son
 *  dossier, et même le début de construction de son bulletin ». Règles pures, testées (player-dossier.test.ts) ;
 *  les données viennent de player-dossier-repo.ts. Jamais de montant ni de paiement. */

import { PARTICIPATED, watchReasons } from "@/lib/coach-report";
import { departureSignal } from "@/lib/departure-signals";

const round1 = (x: number) => Math.round(x * 10) / 10;
const mean = (xs: number[]) => (xs.length ? round1(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/* ── Liste des joueuses : petites pastilles d'état ─────────────────────────────────────────────────────────── */

export type Tone = "good" | "warn" | "bad" | "info" | "muted";

export interface ListStatusInput {
  /** Jour de la dernière évaluation d'un éducateur (AAAA-MM-JJ). */
  lastEvaluation: string | null;
  /** Présences des 28 derniers jours. */
  recent: { present: number; total: number };
  /** Une fiche de blessure encore ouverte (à appeler ou en suivi). */
  openIncident: boolean;
}

export interface ListBadge {
  key: "evaluation" | "presence" | "blessure";
  label: string;
  tone: Tone;
}

/** Les pastilles d'une joueuse dans la liste : dernière évaluation, présence récente, blessure. */
export function listBadges(s: ListStatusInput, today: string): ListBadge[] {
  const out: ListBadge[] = [];
  if (s.openIncident) out.push({ key: "blessure", label: "Blessure", tone: "bad" });
  if (s.recent.total) {
    const rate = Math.round((s.recent.present / s.recent.total) * 100);
    out.push({ key: "presence", label: `${s.recent.present}/${s.recent.total} présente`, tone: rate >= 75 ? "good" : rate >= 50 ? "warn" : "bad" });
  }
  if (s.lastEvaluation) {
    const d = daysBetween(s.lastEvaluation, today);
    out.push({ key: "evaluation", label: d <= 0 ? "Évaluée aujourd'hui" : `Évaluée il y a ${d} j`, tone: d <= 14 ? "good" : d <= 28 ? "warn" : "bad" });
  } else {
    out.push({ key: "evaluation", label: "Jamais évaluée", tone: "muted" });
  }
  return out;
}

/** Recherche sans accents ni majuscules (« melia » trouve « Mélia »). */
export const searchKey = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/* ── Sondage de la borne : ses réponses pratique par pratique ─────────────────────────────────────────────── */

export interface SurveyRow {
  date: string;
  group: string;
  status: string;
  practiceRating: number | null;
  fatigue: number | null;
  coachHelped: boolean | null;
  coachHelpers: string[];
  peerHelped: boolean | null;
  peerHelpers: string[];
  themeAnswer: string | null;
  themeExpected: string | null;
  themeCorrect: boolean | null;
}

export interface SurveyStats {
  answers: number;
  pleasure: number | null;
  fatigue: number | null;
  /** Part des pratiques où elle dit qu'une coach l'a aidée ou encouragée (%), sur celles où elle a répondu. */
  coachHelpedRate: number | null;
  peerHelpedRate: number | null;
  theme: { asked: number; correct: number; rate: number | null };
  /** Les coachs et les filles qu'elle nomme le plus souvent. */
  topCoaches: { name: string; times: number }[];
  topPeers: { name: string; times: number }[];
  /** Courbes simples, de la plus ancienne à la plus récente. */
  series: { date: string; pleasure: number | null; fatigue: number | null }[];
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : null);
const top = (names: string[], n = 3) => {
  const c = new Map<string, number>();
  for (const x of names) if (x) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].map(([name, times]) => ({ name, times })).sort((a, b) => b.times - a.times || a.name.localeCompare(b.name, "fr")).slice(0, n);
};

/** Les rangées où elle a répondu à au moins une question du sondage. */
export const answered = (r: SurveyRow) => r.practiceRating != null || r.fatigue != null || r.coachHelped != null || r.peerHelped != null || r.themeAnswer != null;

export function surveyStats(rows: SurveyRow[]): SurveyStats {
  const list = rows.filter(answered).sort((a, b) => a.date.localeCompare(b.date));
  const nums = (k: "practiceRating" | "fatigue") => list.map((r) => r[k]).filter((v): v is number => typeof v === "number");
  const coach = list.filter((r) => r.coachHelped != null);
  const peer = list.filter((r) => r.peerHelped != null);
  const theme = list.filter((r) => r.themeAnswer != null && r.themeCorrect != null);
  const correct = theme.filter((r) => r.themeCorrect).length;
  return {
    answers: list.length,
    pleasure: mean(nums("practiceRating")),
    fatigue: mean(nums("fatigue")),
    coachHelpedRate: pct(coach.filter((r) => r.coachHelped).length, coach.length),
    peerHelpedRate: pct(peer.filter((r) => r.peerHelped).length, peer.length),
    theme: { asked: theme.length, correct, rate: pct(correct, theme.length) },
    topCoaches: top(list.flatMap((r) => r.coachHelpers)),
    topPeers: top(list.flatMap((r) => r.peerHelpers)),
    series: list.filter((r) => r.practiceRating != null || r.fatigue != null).map((r) => ({ date: r.date, pleasure: r.practiceRating, fatigue: r.fatigue }))
  };
}

/* ── Rapports des éducateurs : tendance de la moyenne ─────────────────────────────────────────────────────── */

export type TrendDir = "hausse" | "stable" | "baisse";

/** La moyenne des 3 premières pratiques évaluées contre celle des 3 dernières (au moins 4 pratiques). */
export function overallTrend(overalls: { date: string; overall: number | null }[]): { start: number; recent: number; dir: TrendDir } | null {
  const vals = [...overalls].sort((a, b) => a.date.localeCompare(b.date)).map((o) => o.overall).filter((v): v is number => typeof v === "number");
  if (vals.length < 4) return null;
  const start = mean(vals.slice(0, 3))!;
  const recent = mean(vals.slice(-3))!;
  const delta = recent - start;
  return { start, recent, dir: delta >= 0.3 ? "hausse" : delta <= -0.3 ? "baisse" : "stable" };
}

/* ── Alertes du résumé ─────────────────────────────────────────────────────────────────────────────────────── */

export interface DossierAlert {
  tone: Tone;
  text: string;
}

export interface AlertInput {
  today: string;
  incidents: { status: string; kind: string; date: string | null }[];
  attendance: { date: string; status: string; activityType: string }[];
  evaluations: { date: string; ratings: Record<string, number> | null }[];
  feedback: { date: string; practice_rating: number | null; fatigue: number | null }[];
  lastEvaluation: string | null;
  health: string | null;
}

/** Ce qu'un éducateur doit savoir avant la prochaine pratique : blessure ouverte, santé, absences, signes à suivre. */
export function dossierAlerts(a: AlertInput): DossierAlert[] {
  const out: DossierAlert[] = [];
  for (const i of a.incidents.filter((x) => x.status !== "fermee")) {
    out.push({ tone: "bad", text: `${i.kind === "choc-tete" ? "Choc à la tête" : "Blessure"}${i.date ? ` le ${shortDay(i.date)}` : ""} : ${i.status === "ouverte" ? "parent à appeler" : "en suivi, pas encore de retour au jeu confirmé"}.` });
  }
  if (a.health) out.push({ tone: "warn", text: `Santé (fiche du parent) : ${a.health}` });
  const marks = a.attendance.filter((x) => x.activityType === "Pratique" && x.date <= a.today).map((x) => ({ date: x.date, present: PARTICIPATED.includes(x.status) }));
  const signal = departureSignal(marks, a.today);
  if (signal) out.push({ tone: "warn", text: `${signal.reason.charAt(0).toUpperCase()}${signal.reason.slice(1)}.` });
  for (const r of watchReasons({ evaluations: [...a.evaluations].sort((x, y) => x.date.localeCompare(y.date)), feedback: [...a.feedback].sort((x, y) => x.date.localeCompare(y.date)) })) out.push({ tone: "warn", text: `${r}.` });
  if (!a.lastEvaluation) out.push({ tone: "info", text: "Pas encore évaluée par un éducateur cette saison." });
  else if (daysBetween(a.lastEvaluation, a.today) > 21) out.push({ tone: "info", text: `Dernière évaluation il y a ${daysBetween(a.lastEvaluation, a.today)} jours.` });
  return out;
}

export const shortDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { day: "numeric", month: "short", timeZone: "UTC" });

/* ── Bulletin en construction : ce qui est prêt et ce qui manque ──────────────────────────────────────────── */

export interface BulletinCheckInput {
  criteria: { label: string; count: number }[];
  wellbeingAnswers: number;
  attendanceTotal: number;
  practicesEvaluated: number;
  coaches: number;
  objectives: number;
  familyComments: number;
  captainTimes: number;
  /** Vidéo de l'étape (mi-saison ou fin) déjà déposée. */
  checkpointVideo: boolean | null;
  firstName: string;
  daysLeft: number;
}

export interface BulletinCheck {
  label: string;
  done: boolean;
  detail: string;
}

/** Minimum pour un bulletin solide : 3 notes par critère, au moins 2 éducateurs, 3 réponses au sondage. */
export const BULLETIN_MIN = { perCriterion: 3, coaches: 2, wellbeing: 3 };

export function bulletinChecklist(b: BulletinCheckInput): BulletinCheck[] {
  const list: BulletinCheck[] = b.criteria.map((c) => ({
    label: c.label,
    done: c.count >= BULLETIN_MIN.perCriterion,
    detail: c.count ? `${c.count} note${c.count > 1 ? "s" : ""}${c.count < BULLETIN_MIN.perCriterion ? ` sur ${BULLETIN_MIN.perCriterion} souhaitées` : ""}` : "Aucune note encore"
  }));
  list.push({ label: "Deux regards d'éducateurs", done: b.coaches >= BULLETIN_MIN.coaches, detail: b.coaches ? `${b.coaches} éducateur${b.coaches > 1 ? "s" : ""} l'ont évaluée` : "Personne ne l'a évaluée" });
  list.push({ label: "Présences", done: b.attendanceTotal > 0, detail: b.attendanceTotal ? `${b.attendanceTotal} pratique${b.attendanceTotal > 1 ? "s" : ""} notée${b.attendanceTotal > 1 ? "s" : ""}` : "Aucune présence notée" });
  list.push({ label: "Bien-être (sondage de la borne)", done: b.wellbeingAnswers >= BULLETIN_MIN.wellbeing, detail: b.wellbeingAnswers ? `${b.wellbeingAnswers} réponse${b.wellbeingAnswers > 1 ? "s" : ""}` : "Elle n'a pas encore répondu" });
  list.push({ label: "Objectifs individuels", done: b.objectives > 0, detail: b.objectives ? `${b.objectives} objectif${b.objectives > 1 ? "s" : ""}` : "À fixer avec elle" });
  list.push({ label: "Le mot pour la famille", done: b.familyComments > 0, detail: b.familyComments ? `${b.familyComments} mot${b.familyComments > 1 ? "s" : ""} écrit${b.familyComments > 1 ? "s" : ""}` : `À écrire avant la remise (${b.daysLeft > 0 ? `dans ${b.daysLeft} jours` : "date passée"})` });
  if (b.checkpointVideo !== null) list.push({ label: "Vidéo de progression de l'étape", done: b.checkpointVideo, detail: b.checkpointVideo ? "Déposée" : "Pas encore filmée" });
  list.push({ label: "Capitaine (leadership)", done: b.captainTimes > 0, detail: b.captainTimes ? `${b.captainTimes} fois` : `Pas encore capitaine : facultatif` });
  return list;
}

/** Les éléments essentiels (le capitanat est facultatif). */
export const bulletinProgress = (checks: BulletinCheck[]) => {
  const core = checks.filter((c) => !c.label.startsWith("Capitaine"));
  return { done: core.filter((c) => c.done).length, total: core.length };
};
