import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { jsonError } from "@/lib/http";
import { signRuleOfTwo } from "@/lib/rule-of-two-repo";

/** Mon dossier : l'éducateur s'engage à la règle de deux (nom tapé + date + IP). */
export async function POST(request: Request) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const b = (await request.json().catch(() => null)) as { name?: string } | null;
  if (typeof b?.name !== "string") return jsonError("Paramètres invalides", 400);
  try {
    const problem = await signRuleOfTwo({
      coachId,
      typedName: b.name,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: request.headers.get("user-agent")
    });
    if (problem) return jsonError(problem, 422);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur", 500);
  }
  return NextResponse.json({ ok: true, signedAt: new Date().toISOString() });
}
