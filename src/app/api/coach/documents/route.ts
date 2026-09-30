import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityById } from "@/lib/coach-portal-repo";
import { getDocumentsForEntity } from "@/lib/documents-repo";
import { jsonError } from "@/lib/http";

/** Lecture seule — un entraîneur ne consulte que les documents de ses
 *  propres activités (contrairement à l'admin, jamais les documents
 *  d'inscription/de lead, qui contiennent des données financières). */
export async function GET(request: Request) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  if (entityType !== "coach_activity" || !entityId) return jsonError("Paramètres invalides", 400);
  if (!(await getCoachActivityById(coachId, entityId))) return jsonError("Activité introuvable", 404);

  const documents = await getDocumentsForEntity("coach_activity", entityId);
  return NextResponse.json({ documents });
}
