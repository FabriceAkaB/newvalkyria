import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { createTrialSlot, getAllTrialSlots } from "@/lib/season-admin-repo";

export async function GET() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const slots = await getAllTrialSlots();
  return NextResponse.json({ slots });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const body = (await request.json().catch(() => null)) as {
    slotDate?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    maxPlaces?: number;
    eligibleBirthYears?: string[];
    eligibleLevels?: string[] | null;
  } | null;

  if (!body?.slotDate || !body.startTime || !body.endTime || !body.location || !body.eligibleBirthYears?.length) {
    return jsonError("Date, heures, lieu et au moins une année admissible sont requis.", 400);
  }

  try {
    const id = await createTrialSlot({
      slotDate: body.slotDate,
      startTime: body.startTime,
      endTime: body.endTime,
      location: body.location,
      maxPlaces: body.maxPlaces ?? 5,
      eligibleBirthYears: body.eligibleBirthYears,
      eligibleLevels: body.eligibleLevels ?? null
    });
    return NextResponse.json({ id });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}
