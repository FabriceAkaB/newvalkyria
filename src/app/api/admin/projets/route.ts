import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { ensureProjectScenario, scheduleProject } from "@/lib/project-pipeline-repo";

export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["chiffrer", "agenda"]), key: z.string().min(2).max(60) });

/** Projets à lancer : « chiffrer » ouvre (ou crée) le scénario du calculateur ; « agenda » place les étapes dans les tâches de JP. */
export async function POST(request: Request) {
  if ((await getCurrentAdminRole()) !== "admin") return jsonError("Accès réservé à l'administrateur.", 403);
  try {
    const body = schema.parse(await request.json());
    if (body.action === "chiffrer") return NextResponse.json({ scenarioId: await ensureProjectScenario(body.key) });
    return NextResponse.json({ scheduled: await scheduleProject(body.key) });
  } catch (err) {
    if (err instanceof ZodError) return jsonError("Demande invalide.", 400);
    return jsonError(err instanceof Error ? err.message : "Erreur", 400);
  }
}
