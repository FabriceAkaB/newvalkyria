import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { deleteRegistration, updateRegistrationStatus, type RegistrationStatus } from "@/lib/sport-etudes-repo";

const VALID_STATUSES: readonly string[] = ["pending", "confirmed", "paid", "cancelled"] satisfies readonly RegistrationStatus[];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  if (!body?.status || !VALID_STATUSES.includes(body.status)) return jsonError("Statut invalide", 400);

  try {
    await updateRegistrationStatus(id, body.status as RegistrationStatus);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  try {
    await deleteRegistration(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
