import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { createSlot, getSeasonSlots } from "@/lib/season-admin-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ seasonId: string }> }) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }
  const { seasonId } = await params;
  try {
    const slots = await getSeasonSlots(seasonId);
    return NextResponse.json({ slots });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de chargement", 500);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ seasonId: string }> }) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }
  const { seasonId } = await params;
  const body = (await request.json().catch(() => null)) as {
    day?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    maxPlaces?: number;
    recommendedForAdvanced?: boolean;
    advancedOnly?: boolean;
    categoryIds?: string[];
    programIds?: string[];
  } | null;

  if (!body || !body.day || !body.startTime || !body.endTime || !body.location || typeof body.maxPlaces !== "number") {
    return jsonError("Paramètres invalides", 400);
  }

  try {
    const id = await createSlot(seasonId, {
      day: body.day,
      startTime: body.startTime,
      endTime: body.endTime,
      location: body.location,
      maxPlaces: body.maxPlaces,
      recommendedForAdvanced: body.recommendedForAdvanced ?? false,
      advancedOnly: body.advancedOnly ?? false,
      categoryIds: body.categoryIds ?? [],
      programIds: body.programIds ?? []
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de création", 500);
  }
}
