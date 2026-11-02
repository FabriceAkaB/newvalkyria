import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoach } from "@/lib/coaches-repo";
import { createExercise, getExercises, parseExerciseBody } from "@/lib/exercises-repo";
import { jsonError } from "@/lib/http";

/** Bibliothèque d'exercices partagée entre admin et entraîneurs — un
 *  entraîneur peut y ajouter un exercice pour l'utiliser dans ses séances,
 *  mais ne peut pas modifier/supprimer les exercices existants (réservé à
 *  l'admin, voir /api/admin/exercises) pour éviter qu'un coach n'écrase le
 *  travail d'un autre. L'exercice ajouté part « à tester » dans la banque. */
export async function GET() {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const exercises = await getExercises();
  return NextResponse.json({ exercises });
}

export async function POST(request: Request) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return jsonError("Titre requis", 400);
  }

  const coach = await getCoach(coachId);
  const input = parseExerciseBody(body);
  input.author = coach ? `${coach.first_name} ${coach.last_name}`.trim() : null;
  const id = await createExercise(input, { coachId });

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
