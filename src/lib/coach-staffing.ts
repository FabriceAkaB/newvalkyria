/** Éducateurs de chaque pratique, d'après MonClubSportif (JP, 16 nov. 2026) : MCS fait foi.
 *  - Un éducateur qui a dit « présent » (ou « en retard ») dans MCS est assigné d'avance à la pratique dans le site
 *    (portail, horaire, paie) ; « absent » dans MCS = absent dans le site (pas payé) ; sans réponse = pas compté.
 *  - Il faut 2 éducateurs par pratique : sinon une tâche pour JP, due au moins 3 jours avant la pratique.
 *  Règles pures, testées (coach-staffing.test.ts). Le robot : `syncCoachSchedule` (mcs-robot-runner.ts). */

export const MIN_EDUCATORS = 2;
/** La tâche « trouver un éducateur » est due au plus tard 3 jours avant la pratique. */
export const ALERT_DAYS_AHEAD = 3;
/** On regarde les pratiques des 3 prochaines semaines. */
export const STAFFING_HORIZON_DAYS = 21;
export const ASSIGNED_BY_MCS = "MonClubSportif";

export type CoachIntent = "vient" | "absent" | "sans-reponse";

/** État de présence MonClubSportif → intention de l'éducateur. */
export function coachIntent(state: string | null | undefined): CoachIntent {
  if (state === "present" || state === "late") return "vient";
  if (state === "absent") return "absent";
  return "sans-reponse";
}

const RANK: Record<CoachIntent, number> = { vient: 2, absent: 1, "sans-reponse": 0 };

export interface SlotCoach {
  coachId: string;
  name: string;
  intent: CoachIntent;
}

/** Deux équipes MCS à la même heure = une seule pratique : un éducateur compte une fois, avec sa réponse la plus claire. */
export function mergeSlotCoaches(rows: SlotCoach[]): SlotCoach[] {
  const by = new Map<string, SlotCoach>();
  for (const r of rows) {
    const cur = by.get(r.coachId);
    if (!cur || RANK[r.intent] > RANK[cur.intent]) by.set(r.coachId, r);
  }
  return [...by.values()].sort((a, b) => RANK[b.intent] - RANK[a.intent] || a.name.localeCompare(b.name, "fr"));
}

export function staffingOf(coaches: SlotCoach[]) {
  const coming = coaches.filter((c) => c.intent === "vient");
  const absent = coaches.filter((c) => c.intent === "absent");
  const noAnswer = coaches.filter((c) => c.intent === "sans-reponse");
  return { coming, absent, noAnswer, missing: Math.max(0, MIN_EDUCATORS - coming.length), ok: coming.length >= MIN_EDUCATORS };
}

export interface ExistingAssignment {
  id: string;
  coachId: string;
  status: string;
  assignedBy: string | null;
  confirmed: boolean;
  paid: boolean;
}

export interface AssignmentPlan {
  insert: string[];
  /** Assignations à passer à « absent » (l'éducateur s'est mis absent dans MCS). */
  absent: string[];
  /** Assignations remises à « présent » (absent dans le site, présent de nouveau dans MCS). */
  present: string[];
  /** Assignations créées par MCS dont l'éducateur a retiré sa réponse : enlevées. */
  remove: string[];
}

/** Ce qu'il faut changer dans les assignations d'une pratique à venir pour suivre MCS.
 *  Jamais touché : une assignation payée ou déjà confirmée (présence faite) ; une assignation faite à la main
 *  n'est jamais enlevée, seulement passée à « absent » si l'éducateur se met absent dans MCS. */
export function assignmentPlan(existing: ExistingAssignment[], coaches: SlotCoach[]): AssignmentPlan {
  const plan: AssignmentPlan = { insert: [], absent: [], present: [], remove: [] };
  for (const c of coaches) {
    const a = existing.find((x) => x.coachId === c.coachId);
    if (a && (a.paid || a.confirmed)) continue;
    if (c.intent === "vient") {
      if (!a) plan.insert.push(c.coachId);
      else if (a.status === "absent") plan.present.push(a.id);
    } else if (c.intent === "absent") {
      if (a && a.status !== "absent") plan.absent.push(a.id);
    } else if (a && a.assignedBy === ASSIGNED_BY_MCS) {
      plan.remove.push(a.id);
    }
  }
  return plan;
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Échéance de la tâche : 3 jours avant la pratique, ou aujourd'hui si c'est déjà plus proche. */
export function shortageDue(date: string, today: string): string {
  const due = addDays(date, -ALERT_DAYS_AHEAD);
  return due < today ? today : due;
}

export const shortageRef = (date: string, start: string) => `educateurs:${date}:${start}`;

const DAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export function slotLabel(date: string, start: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const [h, m] = start.split(":");
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${Number(h)} h${m && m !== "00" ? ` ${m}` : ""}`;
}

const firstNames = (list: SlotCoach[]) => list.map((c) => c.name.split(" ")[0]).join(", ");

/** La tâche de JP quand une pratique n'a pas ses 2 éducateurs. */
export function shortageTask(input: { date: string; start: string; group: string; coaches: SlotCoach[] }): { title: string; details: string } {
  const s = staffingOf(input.coaches);
  const title = `Trouver ${s.missing === 1 ? "un 2e éducateur" : `${s.missing} éducateurs`} : ${slotLabel(input.date, input.start)}, ${input.group}`;
  const lines = [
    `Il faut ${MIN_EDUCATORS} éducateurs ; ${s.coming.length ? `présent${s.coming.length > 1 ? "s" : ""} dans MonClubSportif : ${firstNames(s.coming)}` : "personne n'a dit présent dans MonClubSportif"}.`,
    s.absent.length ? `Absent${s.absent.length > 1 ? "s" : ""} : ${firstNames(s.absent)}.` : null,
    s.noAnswer.length ? `Pas encore répondu : ${firstNames(s.noAnswer)} (lui demander de mettre sa présence dans MonClubSportif).` : null,
    "La tâche se coche toute seule quand 2 éducateurs sont présents dans MonClubSportif."
  ];
  return { title, details: lines.filter(Boolean).join("\n") };
}
