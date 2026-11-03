/** Report automatique des tâches du Mandalart (demande de JP, 2 nov. 2026) — règles pures.
 *  Dans chaque objectif, les tâches se suivent :
 *  - une tâche ouverte (à faire ou en cours) dont la date est passée est reportée au lendemain de sa date,
 *    c'est-à-dire aujourd'hui (le report tourne chaque matin) ;
 *  - les tâches qui suivent sont réorganisées en conséquence : une par jour derrière la tâche reportée,
 *    seulement si elles se font rattraper (une tâche loin dans le calendrier garde sa date) ;
 *  - une tâche à date fixe ne bouge jamais et ne fait glisser personne ;
 *  - faite, abandonnée ou sans date : rien ne bouge. */

export interface SchedTask {
  code: string;
  objective: string;
  due: string | null;
  status: "a_faire" | "en_cours" | "fait" | "abandonne";
  fixed: boolean;
}

export interface SchedChange {
  code: string;
  from: string;
  to: string;
  /** « retard » = pas faite à sa date ; « suite » = réorganisée derrière une tâche reportée du même objectif. */
  reason: "retard" | "suite";
}

const isOpen = (t: SchedTask) => t.status === "a_faire" || t.status === "en_cours";
const nextDay = (iso: string) => new Date(Date.parse(`${iso}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);

export function rescheduleTasks(tasks: SchedTask[], today: string): SchedChange[] {
  const changes: SchedChange[] = [];
  const byObjective = new Map<string, SchedTask[]>();
  for (const t of tasks) if (t.due && isOpen(t)) byObjective.set(t.objective, [...(byObjective.get(t.objective) ?? []), t]);
  for (const list of byObjective.values()) {
    list.sort((a, b) => a.due!.localeCompare(b.due!) || a.code.localeCompare(b.code, "fr", { numeric: true }));
    let lastMoved: string | null = null; // date de la dernière tâche déplacée dans cet objectif
    for (const t of list) {
      if (t.fixed) continue;
      let next = t.due!;
      let reason: SchedChange["reason"] | null = null;
      if (next < today) {
        next = today;
        reason = "retard";
      }
      if (lastMoved && next <= lastMoved) {
        next = nextDay(lastMoved);
        reason = reason ?? "suite";
      }
      if (next !== t.due) {
        changes.push({ code: t.code, from: t.due!, to: next, reason: reason ?? "suite" });
        lastMoved = next;
      }
    }
  }
  return changes;
}
