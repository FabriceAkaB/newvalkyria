import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { assignCoach, getActivity, getActivityAssignments } from "@/lib/coaches-repo";
import { jsonError } from "@/lib/http";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const assignments = await getActivityAssignments(id);
  return NextResponse.json({ assignments });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { coachId?: string } | null;
  if (!body?.coachId) return jsonError("coachId requis", 400);

  const activity = await getActivity(id);
  if (!activity) return jsonError("Activité introuvable", 404);

  try {
    const assignment = await assignCoach(id, body.coachId, activity.start_time, activity.end_time);
    return NextResponse.json({ ok: true, assignment }, { status: 201 });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur", 400);
  }
}
