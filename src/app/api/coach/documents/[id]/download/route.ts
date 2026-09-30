import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoachActivityById } from "@/lib/coach-portal-repo";
import { getDocumentEntityRef, getDocumentSignedUrl } from "@/lib/documents-repo";
import { jsonError } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const ref = await getDocumentEntityRef(id);
  if (!ref || ref.entity_type !== "coach_activity" || !(await getCoachActivityById(coachId, ref.entity_id))) {
    return jsonError("Document introuvable", 404);
  }

  const signedUrl = await getDocumentSignedUrl(id);
  if (!signedUrl) return jsonError("Document introuvable", 404);
  return NextResponse.json({ signedUrl });
}
