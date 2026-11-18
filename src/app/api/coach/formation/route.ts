import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { markModuleRead } from "@/lib/coach-training-repo";
import { jsonError } from "@/lib/http";

/** Ma formation : l'éducateur confirme avoir lu et compris un module. */
export async function POST(request: Request) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const b = (await request.json().catch(() => null)) as { module?: string } | null;
  if (typeof b?.module !== "string") return jsonError("Paramètres invalides", 400);
  await markModuleRead(coachId, b.module);
  return NextResponse.json({ ok: true });
}
