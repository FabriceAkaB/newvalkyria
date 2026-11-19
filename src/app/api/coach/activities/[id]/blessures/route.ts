import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityAccess } from "@/lib/coach-portal-repo";
import { getCoach } from "@/lib/coaches-repo";
import { jsonError } from "@/lib/http";
import { checkIncident } from "@/lib/player-incidents";
import { getActivityIncidents, getEmergencyContacts, reportIncident } from "@/lib/player-incidents-repo";
import { getSurveyData } from "@/lib/practice-survey-repo";

/** Fiches de blessure d'une pratique et contact d'urgence de chaque joueuse attendue (éducateurs de l'équipe). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  if (!(await getCoachActivityAccess(coachId, id))) return jsonError("Activité introuvable", 404);
  const data = await getSurveyData(id);
  const players = (data?.roster ?? []).map((p) => ({ id: p.registrationId, name: `${p.firstName} ${p.lastName.trim().charAt(0)}.`.trim() }));
  const [incidents, contacts] = await Promise.all([getActivityIncidents(id), getEmergencyContacts(players.map((p) => p.id))]);
  return NextResponse.json({ players, incidents, contacts });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;
  if (!(await getCoachActivityAccess(coachId, id))) return jsonError("Activité introuvable", 404);
  const check = checkIncident((await request.json().catch(() => null)) as Record<string, unknown> | null);
  if (!check.ok) return jsonError(check.error, 422);
  const [data, coach] = await Promise.all([getSurveyData(id), getCoach(coachId)]);
  const player = data?.roster.find((p) => p.registrationId === check.value.registrationId);
  if (!player) return jsonError("Cette joueuse n'est pas attendue à cette pratique.", 403);
  const incident = await reportIncident({
    activityId: id,
    coachId,
    reportedBy: coach ? `${coach.first_name} ${coach.last_name}`.trim() : "Éducateur",
    playerName: `${player.firstName} ${player.lastName}`.trim(),
    incident: check.value
  });
  return NextResponse.json({ incident });
}
