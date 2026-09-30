import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityById } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";
import { getPlaytimeSegments, substituteIn, substituteOut } from "@/lib/match-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  if (!(await getCoachActivityById(coachId, id))) return jsonError("Activité introuvable", 404);
  const segments = await getPlaytimeSegments(id);
  return NextResponse.json({ segments });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  if (!(await getCoachActivityById(coachId, id))) return jsonError("Activité introuvable", 404);

  const body = (await request.json().catch(() => null)) as { action?: "in" | "out"; registrationId?: string; minute?: number } | null;
  if (!body?.registrationId || (body.action !== "in" && body.action !== "out") || typeof body.minute !== "number") {
    return jsonError("Paramètres invalides", 400);
  }

  if (body.action === "in") await substituteIn(id, body.registrationId, body.minute);
  else await substituteOut(id, body.registrationId, body.minute);

  return NextResponse.json({ ok: true });
}
