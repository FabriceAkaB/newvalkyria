import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { MANUAL_REQUIREMENTS } from "@/lib/finance-officer";
import { setScenarioCheck } from "@/lib/launch-scenarios-repo";
import { ensureProjectScenario, scheduleProject } from "@/lib/project-pipeline-repo";

export const dynamic = "force-dynamic";

const schema = z.union([
  z.object({ action: z.enum(["chiffrer", "agenda"]), key: z.string().min(2).max(60) }),
  z.object({ action: z.literal("requis"), scenarioId: z.string().uuid(), requirement: z.enum(MANUAL_REQUIREMENTS.map((r) => r.key) as [string, ...string[]]), done: z.boolean() })
]);

/** Projets à lancer : « chiffrer » ouvre (ou crée) le scénario du calculateur ; « agenda » place les étapes dans les tâches de JP. */
export async function POST(request: Request) {
  if ((await getCurrentAdminRole()) !== "admin") return jsonError("Accès réservé à l'administrateur.", 403);
  try {
    const body = schema.parse(await request.json());
    if (body.action === "requis") {
      await setScenarioCheck(body.scenarioId, body.requirement, body.done);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "chiffrer") return NextResponse.json({ scenarioId: await ensureProjectScenario(body.key) });
    return NextResponse.json({ scheduled: await scheduleProject(body.key) });
  } catch (err) {
    if (err instanceof ZodError) return jsonError("Demande invalide.", 400);
    return jsonError(err instanceof Error ? err.message : "Erreur", 400);
  }
}
