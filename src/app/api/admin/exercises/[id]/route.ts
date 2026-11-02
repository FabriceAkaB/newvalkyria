import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { deleteExercise, parseExerciseBody, setBankDecision, updateExercise } from "@/lib/exercises-repo";
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
  if (action !== "valider" && action !== "annuler-validation" && action !== "retirer" && action !== "remettre") return jsonError("Action invalide", 400);

  try {
    await setBankDecision(id, action, body?.reason ?? null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;

  try {
    await deleteExercise(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
