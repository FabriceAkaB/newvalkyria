/** Espace JP (demande de JP, 6 nov. 2026) : JP se gère comme une ressource de l'académie. Ses tâches du jour viennent
 *  du Mandalart (celles dont il est responsable) et de sa propre liste ; n'importe laquelle peut être confiée à
 *  Christine, à Annie, à un éducateur ou à quelqu'un d'autre (table `team_tasks`, lien personnel /tache/[token]).
 *  Règles pures, testées (team-tasks-core.test.ts) ; la base est dans `team-tasks-repo.ts`. */

export type TeamTaskStatus = "a_faire" | "en_cours" | "fait" | "abandonne";

export const TEAM_STATUS_LABEL: Record<TeamTaskStatus, string> = { a_faire: "À faire", en_cours: "En cours", fait: "Fait", abandonne: "Reprise / abandonnée" };

/** Nom de JP dans `team_tasks.assignee` et dans les responsables du Mandalart. */
export const JP = "JP";

export type Bucket = "retard" | "aujourdhui" | "semaine" | "plus-tard" | "sans-date";

export const BUCKET_LABEL: Record<Bucket, string> = {
  retard: "En retard",
  aujourdhui: "Aujourd'hui",
  semaine: "Cette semaine",
  "plus-tard": "Plus tard",
  "sans-date": "Sans date"
};

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Dimanche de la semaine de `today` (semaine du lundi au dimanche). */
export function weekEnd(today: string): string {
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = dimanche
  return addDays(today, dow === 0 ? 0 : 7 - dow);
}

export function bucketOf(due: string | null, today: string): Bucket {
  if (!due) return "sans-date";
  if (due < today) return "retard";
  if (due === today) return "aujourdhui";
  if (due <= weekEnd(today)) return "semaine";
  return "plus-tard";
}

/** Une tâche du Mandalart revient à JP si son responsable le nomme (« JP », « JP + Claude Code », « JP + caméra »). */
export function isJpOwner(owner: string | null | undefined): boolean {
  return !!owner && /(^|[^a-z])jp([^a-z]|$)/i.test(owner);
}

export const isOpenTask = (s: TeamTaskStatus) => s === "a_faire" || s === "en_cours";

export interface RemindableTask {
  status: TeamTaskStatus;
  assignee: string;
  assignee_email: string | null;
  due: string | null;
  reminded_at: string | null;
}

/** Rappel à la personne qui a la tâche : la veille de l'échéance, puis aux 2 jours tant qu'elle est en retard.
 *  Jamais pour JP lui-même (il a « Ma journée »), jamais deux fois le même jour. */
export function reminderKind(t: RemindableTask, today: string): "veille" | "retard" | null {
  if (!isOpenTask(t.status) || t.assignee === JP || !t.assignee_email || !t.due) return null;
  const last = t.reminded_at ? new Date(t.reminded_at).toLocaleDateString("en-CA", { timeZone: "America/Toronto" }) : null;
  if (last === today) return null;
  if (t.due === addDays(today, 1)) return "veille";
  if (t.due < today && (!last || last <= addDays(today, -2))) return "retard";
  return null;
}

/** Ordre d'affichage : en retard d'abord, puis par date, puis sans date. */
export function byDue<T extends { due: string | null }>(a: T, b: T): number {
  if (a.due === b.due) return 0;
  if (!a.due) return 1;
  if (!b.due) return -1;
  return a.due < b.due ? -1 : 1;
}
