/** Objectifs d'acquisition des 90 jours (Mandalart P3.8.20, plan « Machine d'acquisition », section 2) :
 *  prospects, essais réservés, essais faits, inscriptions, avis Google, publications et reels d'essai, par semaine,
 *  par mois et pour le trimestre (1er déc. 2026 au 28 févr. 2027) ; coût par prospect, par essai et par inscription,
 *  par canal. Fichier PUR (testé) : les données sont lues dans acquisition-goals-repo.ts. */

import { ACQUISITION_SOURCES, sourceLabel } from "@/lib/acquisition-core";

export const PLAN_START = "2026-12-01";
export const PLAN_END = "2027-02-28";
/** La publicité payante commence le 15 janvier (formation de JP et aimant à prospects d'abord). */
export const ADS_START = "2027-01-15";
/** Cibles de coût (indicateur `cac`) : 25 $ par essai, 70 $ par inscription. */
export const COST_TARGETS = { perTrialCents: 2500, perInscriptionCents: 7000 };

export const METRICS = ["prospects", "trialsBooked", "trialsDone", "inscriptions", "reviews", "posts", "trialReels"] as const;
export type Metric = (typeof METRICS)[number];
export type GoalSet = Record<Metric, number | null>;

export const METRIC_DEFS: Record<Metric, { label: string; help: string }> = {
  prospects: { label: "Nouveaux prospects", help: "Familles jamais inscrites qui ont rempli un formulaire (essai, inscription, liste d'attente), plus celles notées à la main" },
  trialsBooked: { label: "Essais réservés", help: "Demandes d'essai reçues (filles, garçons, séance diagnostique Sport-Études) : l'indicateur roi" },
  trialsDone: { label: "Essais faits", help: "Essais dont la date est passée, sans les annulés et les absentes" },
  inscriptions: { label: "Inscriptions", help: "Inscriptions payées (saison filles, essais convertis, programmes garçons, Sport-Études)" },
  reviews: { label: "Avis Google", help: "Nouveaux avis, d'après le total noté chaque lundi" },
  posts: { label: "Publications", help: "Publications de l'académie (Réseaux sociaux et calendrier de contenu publié)" },
  trialReels: { label: "Reels d'essai", help: "Reels d'essai publiés (calendrier de contenu)" }
};

/** Objectifs par semaine, mois par mois (tableau de la section 2 du plan). Les essais faits n'ont pas de cible, les reels
 *  d'essai commencent en janvier. */
export const WEEKLY_GOALS: Record<string, GoalSet> = {
  "2026-12": { prospects: 10, trialsBooked: 4, trialsDone: null, inscriptions: 2, reviews: 5, posts: 7, trialReels: null },
  "2027-01": { prospects: 25, trialsBooked: 8, trialsDone: null, inscriptions: 4, reviews: 5, posts: 7, trialReels: 3 },
  "2027-02": { prospects: 40, trialsBooked: 12, trialsDone: null, inscriptions: 6, reviews: 5, posts: 7, trialReels: 5 }
};
/** Trimestre au 28 février (≈ du plan ; reels : 3 par semaine en janvier + 5 en février). */
export const QUARTER_GOALS: GoalSet = { prospects: 300, trialsBooked: 100, trialsDone: null, inscriptions: 50, reviews: 60, posts: 90, trialReels: 33 };

/* ── Dates (AAAA-MM-JJ, semaines du lundi au dimanche) ── */

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function weekStart(iso: string): string {
  const dow = (new Date(`${iso.slice(0, 10)}T12:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}
const daysInMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

const FR_MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const FR_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export function frDay(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${FR_SHORT[m - 1]}`;
}
export const monthName = (month: string) => FR_MONTHS[Number(month.slice(5, 7)) - 1];

/** Objectifs de la semaine qui commence `monday` : ceux du mois de son jeudi (semaine ISO). Avant le 1er décembre, ceux
 *  de décembre (aperçu) ; après le 28 février, ceux de février. */
export function weeklyGoalsFor(monday: string): { goals: GoalSet; month: string; preview: boolean } {
  const month = addDays(monday, 3).slice(0, 7);
  if (WEEKLY_GOALS[month]) return { goals: WEEKLY_GOALS[month], month, preview: false };
  const months = Object.keys(WEEKLY_GOALS).sort();
  const fallback = month < months[0] ? months[0] : months[months.length - 1];
  return { goals: WEEKLY_GOALS[fallback], month: fallback, preview: month < months[0] };
}

/** Objectifs du mois : la cible de la semaine × jours du mois ÷ 7 ; null hors du plan. */
export function monthlyGoals(month: string): GoalSet | null {
  const w = WEEKLY_GOALS[month];
  if (!w) return null;
  const f = daysInMonth(month) / 7;
  return Object.fromEntries(METRICS.map((m) => [m, w[m] === null ? null : Math.round(w[m]! * f)])) as GoalSet;
}

export interface GoalPeriod {
  key: "semaine" | "semaine-derniere" | "mois" | "trimestre";
  label: string;
  from: string;
  to: string;
  goals: GoalSet | null;
  /** Part de la période déjà écoulée (aujourd'hui compris), de 0 à 1. */
  elapsed: number;
  /** Objectifs montrés d'avance (le plan commence le 1er décembre). */
  preview: boolean;
}

const elapsedOf = (from: string, to: string, today: string) => {
  if (today < from) return 0;
  if (today > to) return 1;
  return (daysBetween(from, today) + 1) / (daysBetween(from, to) + 1);
};

/** Les 4 périodes revues chaque lundi : cette semaine, la semaine dernière, ce mois-ci (ou décembre avant le plan) et le trimestre. */
export function goalPeriods(today: string): GoalPeriod[] {
  const mon = weekStart(today);
  const last = addDays(mon, -7);
  const thisWeek = weeklyGoalsFor(mon);
  const lastWeek = weeklyGoalsFor(last);
  const month = today < PLAN_START ? PLAN_START.slice(0, 7) : today > PLAN_END ? PLAN_END.slice(0, 7) : today.slice(0, 7);
  const mFrom = `${month}-01`;
  const mTo = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  return [
    { key: "semaine", label: `Cette semaine (${frDay(mon)} au ${frDay(addDays(mon, 6))})`, from: mon, to: addDays(mon, 6), goals: thisWeek.goals, elapsed: elapsedOf(mon, addDays(mon, 6), today), preview: thisWeek.preview },
    { key: "semaine-derniere", label: `Semaine dernière (${frDay(last)} au ${frDay(addDays(last, 6))})`, from: last, to: addDays(last, 6), goals: lastWeek.preview ? null : lastWeek.goals, elapsed: 1, preview: false },
    { key: "mois", label: `${monthName(month).replace(/^./, (c) => c.toUpperCase())}`, from: mFrom, to: mTo, goals: monthlyGoals(month), elapsed: elapsedOf(mFrom, mTo, today), preview: today < PLAN_START },
    { key: "trimestre", label: `Trimestre (${frDay(PLAN_START)} au ${frDay(PLAN_END)})`, from: PLAN_START, to: PLAN_END, goals: QUARTER_GOALS, elapsed: elapsedOf(PLAN_START, PLAN_END, today), preview: today < PLAN_START }
  ];
}

/* ── Les données, ramenées à des événements datés (jour local AAAA-MM-JJ) ── */

export interface AcqEvents {
  /** Chaque formulaire rempli (essai, inscription commencée ou payée, liste d'attente, demande d'information), depuis toujours. */
  forms: { family: string; day: string; source: string | null }[];
  /** Premier jour où la famille a eu une inscription payée (ses formulaires suivants ne sont plus des prospects). */
  clientSince: Map<string, string>;
  /** Prospects notés à la main (messages, appels, kiosque), par canal. */
  manualProspects: { day: string; source: string | null; count: number }[];
  trials: { day: string; trialDate: string | null; cancelled: boolean; absent: boolean; source: string | null }[];
  inscriptions: { day: string; source: string | null }[];
  /** Total d'avis Google noté (indicateur avis_google_total). */
  reviewTotals: { day: string; total: number }[];
  /** Publications : une ligne par groupe (une publication sur 2 réseaux compte une fois). */
  posts: { day: string; key: string }[];
  /** Contenu publié du calendrier (jp_video_shoots) : reels d'essai à part. */
  shoots: { day: string; trialReel: boolean }[];
  /** Dépenses de publicité (publications boostées, Meta, Google). */
  spend: { day: string; cents: number }[];
}

export type Measures = Record<Metric, number | null> & { spendCents: number };

const inRange = (day: string, from: string, to: string) => day >= from && day <= to;

/** Une famille compte comme prospect le jour de son tout premier formulaire, si elle n'était pas déjà cliente. */
export function prospectEvents(forms: AcqEvents["forms"], clientSince: Map<string, string>): { family: string; day: string; source: string | null }[] {
  const first = new Map<string, { family: string; day: string; source: string | null }>();
  for (const f of [...forms].sort((a, b) => a.day.localeCompare(b.day))) {
    if (!f.family) continue;
    const cur = first.get(f.family);
    if (!cur) first.set(f.family, { ...f });
    else if (!cur.source && f.source && f.day === cur.day) cur.source = f.source;
  }
  return [...first.values()].filter((p) => {
    const client = clientSince.get(p.family);
    return !client || client >= p.day;
  });
}

/** Avis gagnés pendant la période : dernier total noté dans la période moins dernier total noté avant (0 si aucun) ;
 *  null tant qu'aucun total n'est noté dans la période. */
export function reviewsGained(totals: AcqEvents["reviewTotals"], from: string, to: string): number | null {
  const sorted = [...totals].sort((a, b) => a.day.localeCompare(b.day));
  const end = [...sorted].reverse().find((t) => t.day <= to);
  if (!end || end.day < from) return null;
  const start = [...sorted].reverse().find((t) => t.day < from);
  return Math.max(0, end.total - (start?.total ?? 0));
}

/** Publications par jour : le plus grand des deux relevés (Réseaux sociaux, calendrier publié), pour ne pas compter deux fois. */
function postsCount(events: AcqEvents, from: string, to: string): number {
  const posts = new Map<string, Set<string>>();
  for (const p of events.posts) if (inRange(p.day, from, to)) posts.set(p.day, (posts.get(p.day) ?? new Set()).add(p.key));
  const shoots = new Map<string, number>();
  for (const s of events.shoots) if (!s.trialReel && inRange(s.day, from, to)) shoots.set(s.day, (shoots.get(s.day) ?? 0) + 1);
  const days = new Set([...posts.keys(), ...shoots.keys()]);
  return [...days].reduce((t, d) => t + Math.max(posts.get(d)?.size ?? 0, shoots.get(d) ?? 0), 0);
}

export function measure(events: AcqEvents, from: string, to: string, today: string): Measures {
  const prospects = prospectEvents(events.forms, events.clientSince).filter((p) => inRange(p.day, from, to)).length + events.manualProspects.filter((m) => inRange(m.day, from, to)).reduce((t, m) => t + m.count, 0);
  const trials = events.trials.filter((t) => inRange(t.day, from, to));
  const done = events.trials.filter((t) => t.trialDate && !t.cancelled && !t.absent && inRange(t.trialDate, from, to) && t.trialDate <= today);
  return {
    prospects,
    trialsBooked: trials.length,
    trialsDone: done.length,
    inscriptions: events.inscriptions.filter((i) => inRange(i.day, from, to)).length,
    reviews: reviewsGained(events.reviewTotals, from, to),
    posts: postsCount(events, from, to),
    trialReels: events.shoots.filter((s) => s.trialReel && inRange(s.day, from, to)).length,
    spendCents: events.spend.filter((s) => inRange(s.day, from, to)).reduce((t, s) => t + s.cents, 0)
  };
}

export type Pace = "atteint" | "en-route" | "en-retard" | "a-venir";

/** Où on en est par rapport à l'objectif, au prorata du temps écoulé (10 % de marge). */
export function pace(actual: number | null, goal: number | null, elapsed: number): Pace | null {
  if (goal === null || actual === null) return null;
  if (actual >= goal) return "atteint";
  if (elapsed <= 0) return "a-venir";
  return actual >= goal * elapsed * 0.9 ? "en-route" : "en-retard";
}

/* ── Par canal : prospects, essais, inscriptions et coûts ── */

export interface ChannelCost {
  source: string | null;
  label: string;
  prospects: number;
  trials: number;
  inscriptions: number;
  spendCents: number;
  costPerProspect: number | null;
  costPerTrial: number | null;
  costPerInscription: number | null;
}

const per = (cents: number, n: number) => (cents > 0 && n > 0 ? Math.round(cents / n) : null);

/** Une ligne par canal (« Comment nous avez-vous connus ? ») ; toute la publicité payée va au canal « Publicité ».
 *  La dernière ligne, « Tous les canaux », donne le coût moyen d'acquisition. */
export function channelCosts(events: AcqEvents, from: string, to: string): ChannelCost[] {
  const known = new Set(ACQUISITION_SOURCES.map((s) => s.id as string));
  const key = (s: string | null) => (s && known.has(s) ? s : null);
  const rows = new Map<string | null, ChannelCost>();
  const row = (s: string | null) => {
    const k = key(s);
    if (!rows.has(k)) rows.set(k, { source: k, label: k ? sourceLabel(k) : "Source inconnue", prospects: 0, trials: 0, inscriptions: 0, spendCents: 0, costPerProspect: null, costPerTrial: null, costPerInscription: null });
    return rows.get(k)!;
  };
  for (const p of prospectEvents(events.forms, events.clientSince)) if (inRange(p.day, from, to)) row(p.source).prospects += 1;
  for (const m of events.manualProspects) if (inRange(m.day, from, to)) row(m.source).prospects += m.count;
  for (const t of events.trials) if (inRange(t.day, from, to)) row(t.source).trials += 1;
  for (const i of events.inscriptions) if (inRange(i.day, from, to)) row(i.source).inscriptions += 1;
  const spend = events.spend.filter((s) => inRange(s.day, from, to)).reduce((t, s) => t + s.cents, 0);
  if (spend) row("publicite").spendCents = spend;
  const order = new Map(ACQUISITION_SOURCES.map((s, i) => [s.id as string | null, i]));
  const list = [...rows.values()]
    .filter((r) => r.prospects || r.trials || r.inscriptions || r.spendCents)
    .sort((a, b) => b.trials - a.trials || b.prospects - a.prospects || (order.get(a.source) ?? 99) - (order.get(b.source) ?? 99));
  const total: ChannelCost = {
    source: "total",
    label: "Tous les canaux",
    prospects: list.reduce((t, r) => t + r.prospects, 0),
    trials: list.reduce((t, r) => t + r.trials, 0),
    inscriptions: list.reduce((t, r) => t + r.inscriptions, 0),
    spendCents: spend,
    costPerProspect: null,
    costPerTrial: null,
    costPerInscription: null
  };
  return [...list, total].map((r) => ({ ...r, costPerProspect: per(r.spendCents, r.prospects), costPerTrial: per(r.spendCents, r.trials), costPerInscription: per(r.spendCents, r.inscriptions) }));
}

/** Phrase de l'indicateur roi pour « Aujourd'hui » et le haut de la page. */
export function trialsHeadline(m: Measures, goals: GoalSet | null, label: string): string {
  const goal = goals?.trialsBooked;
  const n = m.trialsBooked ?? 0;
  return `${label} : ${n} essai${n > 1 ? "s" : ""} réservé${n > 1 ? "s" : ""}${goal ? ` sur ${goal}` : ""}, ${m.prospects} prospect${(m.prospects ?? 0) > 1 ? "s" : ""}${goals?.prospects ? ` sur ${goals.prospects}` : ""}, ${m.inscriptions} inscription${(m.inscriptions ?? 0) > 1 ? "s" : ""}${goals?.inscriptions ? ` sur ${goals.inscriptions}` : ""}`;
}
