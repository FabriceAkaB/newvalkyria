import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { parseExerciseDiagram, setExerciseDiagram } from "@/lib/exercises-repo";
import { jsonError } from "@/lib/http";

/** Un entraîneur peut illustrer visuellement n'importe quel exercice de la
 *  bibliothèque partagée (le schéma est un aide visuel additif, pas une
 *  donnée sensible) — contrairement au texte de l'exercice, réservé à
 *  l'admin une fois l'exercice créé (voir /api/admin/exercises/[id]). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = await request.json().catch(() => undefined);
  const diagram = parseExerciseDiagram(body);
  if (diagram === undefined) return jsonError("Schéma invalide", 400);

  await setExerciseDiagram(id, diagram);
  return NextResponse.json({ ok: true });
}
