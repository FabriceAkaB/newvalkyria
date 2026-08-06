/** Calculs purs (heures, taux, paie) partagés entre le serveur et
 *  l'affichage client — une seule source de vérité pour éviter toute
 *  divergence entre ce qui est calculé et ce qui est montré à l'écran. */

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  return h * 60 + (m || 0);
}

/** Nombre d'heures (décimal) entre deux heures "HH:MM". Jamais négatif. */
export function computeHours(startTime: string, endTime: string): number {
  const minutes = timeToMinutes(endTime) - timeToMinutes(startTime);
  return Math.max(0, minutes) / 60;
}

/** Taux horaire applicable : surcharge ponctuelle > taux par type d'activité
 *  > taux par défaut de l'entraîneur. */
export function resolveHourlyRateCents(input: {
  assignmentRateCents: number | null;
  typeRateCents: number | null;
  defaultRateCents: number;
}): number {
  if (input.assignmentRateCents !== null) return input.assignmentRateCents;
  if (input.typeRateCents !== null) return input.typeRateCents;
  return input.defaultRateCents;
}

/** Lundi 00:00 de la semaine contenant la date donnée. */
export function startOfWeek(date: Date): Date {
  const day = (date.getDay() + 6) % 7; // lundi = 0
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - day);
  return monday;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function formatHours(hours: number): string {
  return `${hours.toFixed(2).replace(/\.00$/, "")} h`;
}

export interface AssignmentComputed {
  hours: number;
  rateCents: number;
  payCents: number;
}

/** Heures et paie d'une assignation — seul le statut "présent" génère des
 *  heures et une rémunération (absent/remplacé/annulé = 0, conformément à
 *  la règle "aucune rémunération si absent"). */
export function computeAssignment(input: {
  status: "present" | "absent" | "replaced" | "cancelled";
  arrivalTime: string | null;
  departureTime: string | null;
  activityStartTime: string;
  activityEndTime: string;
  assignmentRateCents: number | null;
  typeRateCents: number | null;
  defaultRateCents: number;
}): AssignmentComputed {
  const rateCents = resolveHourlyRateCents({
    assignmentRateCents: input.assignmentRateCents,
    typeRateCents: input.typeRateCents,
    defaultRateCents: input.defaultRateCents
  });

  if (input.status !== "present") return { hours: 0, rateCents, payCents: 0 };

  const start = input.arrivalTime ?? input.activityStartTime;
  const end = input.departureTime ?? input.activityEndTime;
  const hours = computeHours(start, end);
  return { hours, rateCents, payCents: Math.round(hours * rateCents) };
}
