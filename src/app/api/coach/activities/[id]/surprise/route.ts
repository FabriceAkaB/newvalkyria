import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityById, setSurpriseMoment } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";

/** Moment surprise prévu (briefing de 5 minutes, P1.4.01) : l'éducateur assigné peut l'écrire ou le changer. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  if (!(await getCoachActivityById(coachId, id))) return jsonError("Activité introuvable", 404);
  const body = (await request.json().catch(() => null)) as { text?: string | null } | null;
  await setSurpriseMoment(id, typeof body?.text === "string" ? body.text : null);
  return NextResponse.json({ ok: true });
}
