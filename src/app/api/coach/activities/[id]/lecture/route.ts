import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { confirmPracticeRead, getCoachActivityAccess, markPracticeSeen } from "@/lib/coach-portal-repo";
import { jsonError } from "@/lib/http";

/** Prise de connaissance de la pratique par l'éducateur assigné :
 *  { item: "deck:<id>" | "block:<id>" } note un élément vu ; { confirm: true } confirme (tout doit être vu). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const entry = await getCoachActivityAccess(coachId, id);
  if (!entry) return jsonError("Activité introuvable", 404);
  if (!entry.assignment) return NextResponse.json({ ok: true, guest: true });
  const body = (await request.json().catch(() => null)) as { item?: unknown; confirm?: unknown } | null;
  try {
    if (body?.confirm === true) return NextResponse.json({ ok: true, readAt: await confirmPracticeRead(entry.assignment.id, id) });
    const item = typeof body?.item === "string" ? body.item : "";
    if (!/^(deck|block):[0-9a-f-]{36}$/i.test(item)) return jsonError("Élément inconnu", 400);
    return NextResponse.json({ ok: true, seen: await markPracticeSeen(entry.assignment.id, item) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur", 422);
  }
}
