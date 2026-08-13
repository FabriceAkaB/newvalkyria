import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { deleteActivity, getActivity, updateActivity } from "@/lib/coaches-repo";
import { jsonError } from "@/lib/http";
import { findTerrainConflicts } from "@/lib/terrains-repo";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
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
    terrainId?: string | null;
  } | null;

  if (!body) return jsonError("Paramètres invalides", 400);
  if (body.startTime && body.endTime && body.endTime <= body.startTime) {
    return jsonError("L'heure de fin doit être après l'heure de début", 400);
  }

  const touchesSchedule = body.activityDate !== undefined || body.startTime !== undefined || body.endTime !== undefined || body.terrainId !== undefined;
  if (touchesSchedule) {
    const current = await getActivity(id);
    if (!current) return jsonError("Activité introuvable", 404);
    const terrainId = body.terrainId !== undefined ? body.terrainId : current.terrain_id;
    if (terrainId) {
      const conflicts = await findTerrainConflicts({
        terrainId,
        activityDate: body.activityDate ?? current.activity_date,
        startTime: body.startTime ?? current.start_time,
        endTime: body.endTime ?? current.end_time,
        excludeActivityId: id
      });
      if (conflicts.length > 0) {
        return jsonError(`Terrain déjà réservé de ${conflicts[0].startTime} à ${conflicts[0].endTime} (${conflicts[0].title ?? conflicts[0].activityType})`, 409);
      }
    }
  }

  await updateActivity(id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  await deleteActivity(id);
  return NextResponse.json({ ok: true });
}
