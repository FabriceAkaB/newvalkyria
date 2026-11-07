import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { jsonError } from "@/lib/http";
import { getTeamTaskByToken, setTeamTaskStatus } from "@/lib/team-tasks-repo";

export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.enum(["en_cours", "fait", "a_faire"]),
  note: z.string().max(2000).nullable().optional(),
  evidenceUrl: z.string().max(1000).nullable().optional()
});

/** La personne qui a reçu une tâche de JP dit où elle en est, par son lien personnel (sans compte). */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const task = await getTeamTaskByToken(token);
    if (!task) return jsonError("Lien invalide", 404);
    if (task.status === "abandonne") return jsonError("JP a repris cette tâche : plus rien à faire.", 409);
    const body = schema.parse(await request.json());
    const url = body.evidenceUrl?.trim();
    if (url && !/^https?:\/\//i.test(url)) return jsonError("Le lien doit commencer par https://", 400);
    await setTeamTaskStatus({ token, status: body.status, note: body.note, evidenceUrl: url ?? null, by: task.assignee });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError) return jsonError("Données invalides", 400);
    console.error("Tâche POST failed", err);
    return jsonError("Erreur, réessaie dans un instant", 500);
  }
}
