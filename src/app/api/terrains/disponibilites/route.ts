import { NextResponse } from "next/server";

import { jsonError } from "@/lib/http";
import { getAvailability } from "@/lib/terrain-rentals-repo";

export const dynamic = "force-dynamic";

/** Créneaux d'un terrain sur une période (max 62 jours) — public. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const terrainId = searchParams.get("terrainId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!terrainId || !from || !to || !dateRe.test(from) || !dateRe.test(to) || to < from) return jsonError("Paramètres invalides", 400);
  const days = (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000;
  if (days > 62) return jsonError("Période trop longue", 400);

  const slots = await getAvailability(terrainId, from, to);
  return NextResponse.json({ slots });
}
