import type { TaskItem } from "@/components/mandalart/task-list";
import type { LiveTask } from "@/lib/mandalart-core";
import { linkLabel } from "@/lib/mandalart-plan";

/** Version légère d'une tâche pour les composants client (le plan complet reste côté serveur). */
export function toItems(tasks: LiveTask[]): TaskItem[] {
  return tasks.map((t) => ({
    code: t.code,
    title: t.title,
    priority: t.priority,
    level: t.level,
    due: t.due,
    owner: t.owner,
    links: t.links.map((id) => ({ id, label: linkLabel(id) })),
    status: t.status,
    note: t.note,
    evidenceUrl: t.evidenceUrl,
    overdue: t.overdue,
    objective: t.objective,
    objectiveName: t.objectiveName,
    pillar: t.pillar,
    addedOn: t.addedOn ?? null
  }));
}
