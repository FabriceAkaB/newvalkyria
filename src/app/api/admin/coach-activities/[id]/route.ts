import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { deleteActivity, updateActivity } from "@/lib/coaches-repo";
import { jsonError } from "@/lib/http";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as {
    activityDate?: string;
    startTime?: string;
    endTime?: string;
    location?: string | null;
    category?: string | null;
    activityType?: string;
    title?: string | null;
    notes?: string | null;
  } | null;

  if (!body) return jsonError("Paramètres invalides", 400);
  if (body.startTime && body.endTime && body.endTime <= body.startTime) {
    return jsonError("L'heure de fin doit être après l'heure de début", 400);
  }

  await updateActivity(id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;
  await deleteActivity(id);
  return NextResponse.json({ ok: true });
}
