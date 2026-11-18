import { NextResponse } from "next/server";

import { isMethodOpen, opensOn } from "@/lib/coach-access-core";
import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityAccess } from "@/lib/coach-portal-repo";
import { getDocumentEntityRef, getDocumentSignedUrl } from "@/lib/documents-repo";
import { jsonError } from "@/lib/http";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const ref = await getDocumentEntityRef(id);
  const own = ref?.entity_type === "coach" && ref.entity_id === coachId;
  if (!ref || (!own && (ref.entity_type !== "coach_activity" || !(await getCoachActivityAccess(coachId, ref.entity_id))))) {
    return jsonError("Document introuvable", 404);
  }

  // Diapos d'une pratique : seulement dans la fenêtre de la méthode (semaine en cours).
  if (ref.entity_type === "coach_activity") {
    const { data: a } = await (getSupabaseAdminClient() as any).from("coach_activities").select("activity_date, activity_type").eq("id", ref.entity_id).maybeSingle();
    if (a && !isMethodOpen(a, new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" }))) return jsonError(`Le plan de cette pratique s'ouvre le ${opensOn(a.activity_date)}.`, 403);
  }
  const signedUrl = await getDocumentSignedUrl(id);
  if (!signedUrl) return jsonError("Document introuvable", 404);
  return NextResponse.json({ signedUrl });
}
