import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { createSlot, getSlots } from "@/lib/private-sessions-repo";

export async function GET(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const slots = await getSlots({ from, to });
  return NextResponse.json({ slots });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as {
    slotDate?: string;
    publicStartTime?: string;
    location?: string | null;
    terrainId?: string | null;
    coachId?: string | null;
    notes?: string | null;
  } | null;

  if (!body?.slotDate?.trim() || !body.publicStartTime?.trim()) {
    return jsonError("Date et heure de début requises", 400);
  }

  const result = await createSlot({
    slotDate: body.slotDate.trim(),
    publicStartTime: body.publicStartTime.trim(),
    location: body.location?.trim() || null,
    terrainId: body.terrainId || null,
    coachId: body.coachId || null,
    notes: body.notes?.trim() || null
  });

  if ("error" in result) {
    return NextResponse.json({ error: "Ce créneau chevauche un autre créneau (bloc de 1h30)", conflicts: result.conflicts }, { status: 409 });
  }

  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
