import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { syncDeliveryEvents } from "@/lib/mcs-robot-runner";

export const maxDuration = 300;

/** « Recalculer maintenant » : relit tout le calendrier MonClubSportif de la saison (sinon fait chaque matin). */
export async function POST() {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const r = await syncDeliveryEvents().catch((e) => ({ teams: 0, events: 0, skipped: e instanceof Error ? e.message : "erreur" }));
  if (r.skipped) return jsonError(r.skipped, 400);
  return NextResponse.json({ ok: true, ...r });
}
