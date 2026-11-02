import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { computeHours } from "@/lib/coach-payroll";
import { getCoachActivityById } from "@/lib/coach-portal-repo";
import { activityEndMs } from "@/lib/coach-report";
import { updateAssignment } from "@/lib/coaches-repo";
import { jsonError } from "@/lib/http";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Confirmation de présence de l'éducateur (P8.3.04) : présent (heures d'arrivée et de départ) ou absent.
 *  Les heures × le taux font la paie dans l'admin ; l'éducateur ne voit que ses heures, jamais l'argent. */
export async function POST(request: Request) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as { activityId?: string; status?: string; arrivalTime?: string; departureTime?: string } | null;
  if (!body?.activityId || (body.status !== "present" && body.status !== "absent")) return jsonError("Paramètres invalides", 400);

  const entry = await getCoachActivityById(coachId, body.activityId);
  if (!entry) return jsonError("Activité introuvable", 404);
  const { activity, assignment } = entry;
  if (assignment.paid) return jsonError("Cette activité est déjà payée : écris à JP pour corriger tes heures.", 409);
  if (assignment.status === "cancelled" || assignment.status === "replaced") return jsonError("Tu n'es plus assigné(e) à cette activité.", 409);
  if (Date.now() < activityEndMs(String(activity.activity_date).slice(0, 10), String(activity.start_time).slice(0, 5)) - 30 * 60000) {
    return jsonError("Tu pourras confirmer ta présence à partir du début de l'activité.", 409);
  }

  if (body.status === "absent") {
    await updateAssignment(assignment.id, { status: "absent", confirmed: true, confirmedBy: "educateur" });
    return NextResponse.json({ ok: true, hours: 0 });
  }

  const arrival = body.arrivalTime ?? String(activity.start_time).slice(0, 5);
  const departure = body.departureTime ?? String(activity.end_time).slice(0, 5);
  if (!HHMM.test(arrival) || !HHMM.test(departure)) return jsonError("Heures invalides (format 18:00).", 400);
  const hours = computeHours(arrival, departure);
  if (hours <= 0) return jsonError("L'heure de départ doit être après l'heure d'arrivée.", 400);
  if (hours > computeHours(String(activity.start_time).slice(0, 5), String(activity.end_time).slice(0, 5)) + 1) {
    return jsonError("Plus d'une heure de plus que l'activité : écris à JP pour faire approuver ces heures.", 400);
  }

  await updateAssignment(assignment.id, { status: "present", arrivalTime: arrival, departureTime: departure, confirmed: true, confirmedBy: "educateur" });
  return NextResponse.json({ ok: true, hours });
}
