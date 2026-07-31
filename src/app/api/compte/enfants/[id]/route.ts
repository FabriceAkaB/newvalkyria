import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { jsonError } from "@/lib/http";
import { getParentUserId } from "@/lib/parent-auth";
import { deleteChild, updateChild } from "@/lib/parent-repo";
import { childSchema } from "@/lib/validations";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Non autorisé", 401);
  const { id } = await params;

  try {
    const payload = childSchema.partial().parse(await request.json());
    await updateChild(id, userId, {
      firstName: payload.firstName,
      lastName: payload.lastName,
      dob: payload.dob,
      level: payload.level !== undefined ? payload.level || null : undefined,
      club: payload.club !== undefined ? payload.club || null : undefined
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    }
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getParentUserId();
  if (!userId) return jsonError("Non autorisé", 401);
  const { id } = await params;

  try {
    await deleteChild(id, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
