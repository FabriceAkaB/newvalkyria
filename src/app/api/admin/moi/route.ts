import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { addMeal, deleteKnowledge, deleteMeal, logHabit, saveCalendarUrl, saveHabit, saveKnowledge, setPlanCheck } from "@/lib/jp-repo";
import { createTeamTask, getAssignees, setTeamTaskStatus, takeBackTeamTask } from "@/lib/team-tasks-repo";

export const dynamic = "force-dynamic";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    title: z.string().max(400).default(""),
    details: z.string().max(4000).nullable().optional(),
    due: date.nullable().optional(),
    assignee: z.string().min(1).max(120),
    assigneeEmail: z.string().email().max(200).nullable().optional(),
    mandalartCode: z.string().min(3).max(20).nullable().optional()
  }),
  z.object({ action: z.literal("status"), id: z.string().uuid(), status: z.enum(["a_faire", "en_cours", "fait", "abandonne"]), note: z.string().max(2000).nullable().optional() }),
  z.object({ action: z.literal("take-back"), id: z.string().uuid() }),
  z.object({ action: z.literal("habit-log"), habitId: z.string().uuid(), day: date, value: z.number().min(0).max(1000).nullable() }),
  z.object({
    action: z.literal("habit-save"),
    id: z.string().uuid().optional(),
    name: z.string().min(2).max(120),
    kind: z.enum(["check", "nombre"]),
    unit: z.string().max(30).nullable().optional(),
    target: z.number().min(0).max(1000),
    active: z.boolean().optional()
  }),
  z.object({
    action: z.literal("meal-add"),
    day: date,
    moment: z.enum(["dejeuner", "diner", "souper", "collation", "avant-match", "eau"]),
    description: z.string().max(500),
    proteinG: z.number().int().min(0).max(500).nullable().optional(),
    quality: z.enum(["bien", "moyen", "a-ameliorer"]).nullable().optional()
  }),
  z.object({ action: z.literal("meal-delete"), id: z.string().uuid() }),
  z.object({
    action: z.literal("knowledge-save"),
    id: z.string().uuid().optional(),
    title: z.string().min(2).max(300),
    sourceType: z.enum(["livre", "video", "cours", "balado", "mentor", "article", "experience"]),
    author: z.string().max(200).nullable().optional(),
    url: z.string().max(1000).nullable().optional(),
    status: z.enum(["a-lire", "en-cours", "fini"]),
    lessons: z.string().max(8000).nullable().optional(),
    applyTo: z.string().max(4000).nullable().optional(),
    tags: z.string().max(300).optional(),
    applied: z.boolean().optional()
  }),
  z.object({ action: z.literal("knowledge-delete"), id: z.string().uuid() }),
  z.object({ action: z.literal("calendar-url"), url: z.string().max(500).nullable() }),
  z.object({ action: z.literal("plan-step"), stepId: z.string().min(2).max(40), done: z.boolean() })
]);

/** Les personnes à qui confier une tâche (menu « Confier à » du Mandalart et de Ma journée). */
export async function GET() {
  if ((await getCurrentAdminRole()) !== "admin") return jsonError("Non autorisé", 401);
  return NextResponse.json({ assignees: await getAssignees() });
}

/** Espace JP (admin seulement) : tâches (ajouter, confier, cocher, reprendre), habitudes, nutrition, connaissances, calendrier, étapes de Mon plan. */
export async function POST(request: Request) {
  if ((await getCurrentAdminRole()) !== "admin") return jsonError("Non autorisé", 401);
  try {
    const body = schema.parse(await request.json());
    if (body.action === "add") {
      const task = await createTeamTask({ ...body, by: "JP" });
      return NextResponse.json({ ok: true, task });
    }
    if (body.action === "status") {
      await setTeamTaskStatus({ id: body.id, status: body.status, note: body.note, by: "JP" });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "plan-step") return NextResponse.json({ ok: true, ...(await setPlanCheck(body.stepId, body.done)) });
    if (body.action === "take-back") await takeBackTeamTask(body.id);
    else if (body.action === "habit-log") await logHabit(body.habitId, body.day, body.value);
    else if (body.action === "habit-save") await saveHabit(body);
    else if (body.action === "meal-add") await addMeal(body);
    else if (body.action === "meal-delete") await deleteMeal(body.id);
    else if (body.action === "knowledge-save") await saveKnowledge(body);
    else if (body.action === "knowledge-delete") await deleteKnowledge(body.id);
    else await saveCalendarUrl(body.url);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return jsonError("Données invalides", 400);
    console.error("Espace JP POST failed", err);
    return jsonError(err instanceof Error ? err.message : "Erreur", 500);
  }
}
