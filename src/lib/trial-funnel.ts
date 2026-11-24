/** Entonnoir des essais sans perte (Mandalart P3.6.10, plan « Machine d'acquisition », section 4).
 *  demande → contactée en moins de 24 h → essai réservé (rappel la veille) → essai fait → offre le lendemain
 *  → relances au jour 3, 7 et 14 → inscrite, ou liste chaude.
 *  Chaque étape faite est une ligne du journal des relances (outreach_log.trial_ref + trial_step) : ce fichier
 *  PUR calcule l'étape de chaque essai et ce qui est à faire aujourd'hui. Accès à la base : acquisition-goals-repo.ts. */

export const TRIAL_STEPS = ["contact", "rappel", "offre", "relance-3", "relance-7", "relance-14", "absente", "liste-chaude", "refus"] as const;
export type TrialStep = (typeof TRIAL_STEPS)[number];

export const isTrialStep = (v: unknown): v is TrialStep => typeof v === "string" && (TRIAL_STEPS as readonly string[]).includes(v);

/** Libellé du bouton (ce que la gérante vient de faire) et type de la ligne du journal des relances. */
export const STEP_DEFS: Record<TrialStep, { label: string; done: string; kind: "relance" | "plus-tard" | "refus" }> = {
  contact: { label: "Contactée", done: "Contactée", kind: "relance" },
  rappel: { label: "Rappel envoyé", done: "Rappel de la veille", kind: "relance" },
  offre: { label: "Offre envoyée", done: "Offre envoyée", kind: "relance" },
  "relance-3": { label: "Relance du jour 3 faite", done: "Relance jour 3", kind: "relance" },
  "relance-7": { label: "Relance du jour 7 faite", done: "Relance jour 7", kind: "relance" },
  "relance-14": { label: "Relance du jour 14 faite", done: "Relance jour 14", kind: "relance" },
  absente: { label: "N'est pas venue", done: "Absente à l'essai", kind: "relance" },
  "liste-chaude": { label: "Liste chaude", done: "Pas prête : liste chaude", kind: "plus-tard" },
  refus: { label: "Pas intéressée", done: "Pas intéressée", kind: "refus" }
};

/** Campagne des lignes du journal des relances écrites par le tableau des essais. */
export const FUNNEL_CAMPAIGN = "Entonnoir des essais";

export type FunnelTable = "registrations" | "boys_trials" | "sport_etudes_registrations";

export interface FunnelTrial {
  /** « registrations:<id> », « boys_trials:<id> »… */
  ref: string;
  table: FunnelTable;
  id: string;
  program: string;
  playerName: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string | null;
  /** Moment de la demande (horodatage ISO). */
  createdAt: string;
  /** Date de l'essai (AAAA-MM-JJ), null tant qu'elle n'est pas fixée. */
  trialDate: string | null;
  cancelled: boolean;
  /** La joueuse a payé une inscription le jour de l'essai ou après. */
  converted: boolean;
  source: string | null;
}

/** Ligne du journal des relances (outreach_log). */
export interface FunnelLog {
  trialRef: string | null;
  step: string | null;
  kind: string;
  at: string;
  parentEmail: string;
  playerName: string | null;
  notes: string | null;
}

export type FunnelStage = "demande" | "a-planifier" | "reserve" | "fait" | "offre" | "absente" | "inscrite" | "liste-chaude" | "perdue";

export const STAGES: { id: FunnelStage; label: string; help: string }[] = [
  { id: "demande", label: "Demande", help: "À contacter en moins de 24 h (appel ou texto)" },
  { id: "a-planifier", label: "À planifier", help: "Contactée, date d'essai à fixer" },
  { id: "reserve", label: "Essai réservé", help: "Rappel la veille : adresse et quoi apporter" },
  { id: "fait", label: "Essai fait", help: "Le lendemain : vidéo, mot de l'éducatrice et l'offre" },
  { id: "offre", label: "Offre envoyée", help: "Relances au jour 3, 7 et 14" },
  { id: "absente", label: "Pas venue", help: "Proposer une autre date" },
  { id: "inscrite", label: "Inscrite", help: "A payé son inscription" },
  { id: "liste-chaude", label: "Liste chaude", help: "Pas prête : un courriel de valeur par semaine" },
  { id: "perdue", label: "Fermée", help: "Annulée ou pas intéressée" }
];
export const stageLabel = (s: FunnelStage) => STAGES.find((x) => x.id === s)?.label ?? s;

/** Étapes encore ouvertes (le tableau principal) ; les autres sont des résultats. */
export const OPEN_STAGES: readonly FunnelStage[] = ["demande", "a-planifier", "reserve", "fait", "offre", "absente"];

export interface FunnelAction {
  /** Étape à noter quand c'est fait ; « planifier » = fixer la date de l'essai (page des essais). */
  step: TrialStep | "planifier";
  label: string;
  /** Jour où c'est dû (AAAA-MM-JJ). */
  due: string;
  /** Dû aujourd'hui ou avant. */
  dueNow: boolean;
  /** En retard (demande sans contact après 24 h, ou dû avant aujourd'hui). */
  late: boolean;
}

export interface FunnelRow extends FunnelTrial {
  stage: FunnelStage;
  /** Étapes faites et leur date (AAAA-MM-JJ). */
  steps: Partial<Record<TrialStep, string>>;
  /** Contactée dans les 24 h suivant la demande (null tant que les 24 h ne sont pas passées sans contact). */
  contactedIn24h: boolean | null;
  next: FunnelAction | null;
  /** Dernière note écrite par la gérante. */
  lastNote: string | null;
}

const DAY_MS = 86_400_000;

export const localDay = (ts: string | Date) => new Date(ts).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Lignes du journal qui concernent cet essai : celles reliées par trial_ref, puis tout échange avec la même famille
 *  (même courriel, même joueuse si le nom est noté) après la demande, qui vaut premier contact. */
function logsFor(t: FunnelTrial, logs: FunnelLog[]): { explicit: FunnelLog[]; loose: FunnelLog[] } {
  const explicit: FunnelLog[] = [];
  const loose: FunnelLog[] = [];
  const email = norm(t.parentEmail);
  const player = norm(t.playerName);
  for (const l of logs) {
    if (l.trialRef) {
      if (l.trialRef === t.ref) explicit.push(l);
      continue;
    }
    if (!email || norm(l.parentEmail) !== email || l.at < t.createdAt) continue;
    if (l.playerName && player && norm(l.playerName) !== player) continue;
    loose.push(l);
  }
  const byAt = (a: FunnelLog, b: FunnelLog) => a.at.localeCompare(b.at);
  return { explicit: explicit.sort(byAt), loose: loose.sort(byAt) };
}

/** Étape et prochaine action d'un essai, à l'instant `now`. */
export function funnelRow(t: FunnelTrial, logs: FunnelLog[], now: Date): FunnelRow {
  const today = localDay(now);
  const { explicit, loose } = logsFor(t, logs);
  const steps: Partial<Record<TrialStep, string>> = {};
  const stepAt: Partial<Record<TrialStep, string>> = {};
  for (const l of explicit) {
    if (!isTrialStep(l.step)) continue;
    steps[l.step] = localDay(l.at); // la plus récente l'emporte (ex. absente puis nouvelle date)
    stepAt[l.step] = l.at;
  }
  // Un échange noté ailleurs dans les relances (courriel, refus, plus tard) après la demande compte aussi.
  const looseExchange = loose.find((l) => l.kind === "relance" || l.kind === "reponse");
  const looseFinal = [...loose].reverse().find((l) => l.kind === "refus" || l.kind === "plus-tard");
  const lastNote = [...explicit, ...loose].reverse().find((l) => l.notes)?.notes ?? null;

  const anyStep = (Object.keys(stepAt) as TrialStep[]).map((k) => stepAt[k]!).sort()[0] ?? null;
  const contactAt = [stepAt.contact, anyStep, looseExchange?.at].filter(Boolean).sort()[0] ?? null;
  const deadline = Date.parse(t.createdAt) + DAY_MS;
  const contactedIn24h = contactAt ? Date.parse(contactAt) <= deadline : now.getTime() > deadline ? false : null;

  const base = { ...t, steps, contactedIn24h, lastNote };
  const action = (step: FunnelAction["step"], label: string, due: string, late?: boolean): FunnelAction => ({
    step,
    label,
    due,
    dueNow: due <= today,
    late: late ?? due < today
  });

  if (t.converted) return { ...base, stage: "inscrite", next: null };
  if (t.cancelled || steps.refus || (looseFinal?.kind === "refus" && !steps["liste-chaude"])) return { ...base, stage: "perdue", next: null };
  if (steps["liste-chaude"] || looseFinal?.kind === "plus-tard") return { ...base, stage: "liste-chaude", next: null };

  if (!contactAt) {
    const late = now.getTime() > deadline;
    return { ...base, stage: "demande", next: action("contact", "Appeler ou texter la famille", localDay(new Date(deadline)), late) };
  }
  // Absente : seulement si notée le jour de l'essai ou après (une nouvelle date plus tard efface l'absence).
  if (steps.absente && (!t.trialDate || steps.absente >= t.trialDate)) {
    return { ...base, stage: "absente", next: action("planifier", "Proposer une autre date d'essai", steps.absente) };
  }
  if (!t.trialDate) return { ...base, stage: "a-planifier", next: action("planifier", "Fixer la date de l'essai", localDay(contactAt)) };
  if (t.trialDate >= today) {
    const eve = addDays(t.trialDate, -1);
    return { ...base, stage: "reserve", next: steps.rappel ? null : action("rappel", "Rappel : adresse, heure, quoi apporter", eve, false) };
  }
  if (!steps.offre) return { ...base, stage: "fait", next: action("offre", "Envoyer la vidéo, le mot de l'éducatrice et l'offre", addDays(t.trialDate, 1)) };

  const offer = steps.offre;
  for (const [step, n] of [["relance-3", 3], ["relance-7", 7], ["relance-14", 14]] as const) {
    if (!steps[step]) return { ...base, stage: "offre", next: action(step, `Relance du jour ${n}`, addDays(offer, n)) };
  }
  // Trois relances faites sans inscription : elle reste dans la liste chaude.
  return { ...base, stage: "liste-chaude", next: null };
}

export interface FunnelBoard {
  rows: FunnelRow[];
  /** Ce qui est à faire aujourd'hui (ou en retard), le plus urgent d'abord. */
  today: FunnelRow[];
  counts: Record<FunnelStage, number>;
  /** Demandes des 30 derniers jours contactées en moins de 24 h. */
  contact24h: { within: number; total: number };
}

/** Le tableau des essais existe depuis le 24 nov. 2026 : une demande plus ancienne encore « ouverte » (aucune étape notée
 *  à l'époque) n'est plus une action à faire, sauf si son essai a lieu à partir de cette date. */
export const FUNNEL_START = "2026-11-24";

/** Essai d'avant le tableau, dont rien n'a été noté : on ne le réclame pas. */
export function isLegacy(r: FunnelRow, since = FUNNEL_START): boolean {
  return localDay(r.createdAt) < since && OPEN_STAGES.includes(r.stage) && !(r.trialDate && r.trialDate >= since) && Object.keys(r.steps).length === 0;
}

/** Tableau complet : une ligne par essai, triée par étape puis par urgence. */
export function buildFunnel(trials: FunnelTrial[], logs: FunnelLog[], now: Date, since = FUNNEL_START): FunnelBoard {
  const rows = trials
    .map((t) => funnelRow(t, logs, now))
    .filter((r) => !isLegacy(r, since))
    // Avant le tableau, le premier contact n'était pas noté : on ne le juge pas.
    .map((r) => (r.contactedIn24h === false && localDay(r.createdAt) < since ? { ...r, contactedIn24h: null } : r));
  const order = new Map(STAGES.map((s, i) => [s.id, i]));
  rows.sort((a, b) => order.get(a.stage)! - order.get(b.stage)! || (a.next?.due ?? "9").localeCompare(b.next?.due ?? "9") || b.createdAt.localeCompare(a.createdAt));
  const urgency = (r: FunnelRow) => (r.next?.step === "contact" ? 0 : r.next?.late ? 1 : 2);
  const today = rows.filter((r) => r.next?.dueNow).sort((a, b) => urgency(a) - urgency(b) || a.next!.due.localeCompare(b.next!.due) || a.createdAt.localeCompare(b.createdAt));
  const counts = Object.fromEntries(STAGES.map((s) => [s.id, 0])) as Record<FunnelStage, number>;
  for (const r of rows) counts[r.stage] += 1;
  const from = Math.max(now.getTime() - 30 * DAY_MS, Date.parse(`${since}T05:00:00Z`));
  const recent = rows.filter((r) => Date.parse(r.createdAt) >= from && r.contactedIn24h !== null);
  return { rows, today, counts, contact24h: { within: recent.filter((r) => r.contactedIn24h).length, total: recent.length } };
}
