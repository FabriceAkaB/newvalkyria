import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { updateSession } from "@/lib/sport-etudes-repo";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as {
    sessionDate?: string;
    startTime?: string | null;
    endTime?: string | null;
    location?: string;
    label?: string;
    isTimeTbd?: boolean;
    active?: boolean;
    adminWarning?: string | null;
  } | null;
  if (!body) return jsonError("Paramètres invalides", 400);

  try {
    await updateSession(id, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
