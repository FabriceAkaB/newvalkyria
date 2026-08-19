import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getSettings, updateManualReservedSpots, updateMaxCapacity } from "@/lib/sport-etudes-repo";

export async function GET() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as { maxCapacity?: number; manualReservedSpots?: number } | null;
  if (!body) return jsonError("Paramètres invalides", 400);

  if (body.maxCapacity !== undefined) {
    if (body.maxCapacity < 1) return jsonError("Capacité maximale invalide", 400);
    await updateMaxCapacity(body.maxCapacity);
  }
  if (body.manualReservedSpots !== undefined) {
    if (body.manualReservedSpots < 0) return jsonError("Nombre de places invalide", 400);
    await updateManualReservedSpots(body.manualReservedSpots);
  }

  return NextResponse.json({ ok: true });
}
