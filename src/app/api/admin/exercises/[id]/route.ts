import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { deleteExerciseSafely, getExerciseDeleteImpact, parseExerciseBody, resetBlockOverrides, setBankDecision, updateExercise } from "@/lib/exercises-repo";
import { jsonError } from "@/lib/http";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return jsonError("Titre requis", 400);
  }

  try {
    const { version } = await updateExercise(id, parseExerciseBody(body), {
      newVersion: body.newVersion === true,
      versionNote: typeof body.versionNote === "string" ? body.versionNote : null
    });
    return NextResponse.json({ ok: true, version });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

/** Décision de JP sur la banque : valider la version en cours, annuler la validation, retirer, remettre à l'essai. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { action?: string; reason?: string } | null;
  const action = body?.action;
  // Toutes les pratiques à venir reprennent la fiche de la banque (ajustements bloc par bloc effacés).
  if (action === "reprendre-partout") {
    const { blocks } = await resetBlockOverrides(id);
    return NextResponse.json({ ok: true, blocks });
  }
  if (action !== "valider" && action !== "annuler-validation" && action !== "retirer" && action !== "remettre" && action !== "reference" && action !== "annuler-reference") return jsonError("Action invalide", 400);

  try {
    await setBankDecision(id, action, body?.reason ?? null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

/** Ce qu'une suppression toucherait : pratiques à venir (bloquantes), passées, notes, routines. Admin seulement. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  try {
    return NextResponse.json(await getExerciseDeleteImpact(id));
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

/** Suppression définitive (JP seulement). Refusée (409) si l'exercice est prévu dans une pratique à venir. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;

  try {
    const result = await deleteExerciseSafely(id);
    if (!result.deleted) {
      const n = result.upcoming.length;
      return NextResponse.json(
        { error: `Prévu dans ${n} pratique${n > 1 ? "s" : ""} à venir : change-le dans ${n > 1 ? "ces pratiques" : "cette pratique"} d'abord, ou retire-le de la banque.`, upcoming: result.upcoming },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
