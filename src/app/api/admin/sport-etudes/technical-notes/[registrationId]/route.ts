import { NextResponse } from "next/server";

import { getCurrentAdminRole, isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getTechnicalNotes, setTechnicalNotes, type NotePhase } from "@/lib/sport-etudes-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ registrationId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { registrationId } = await params;
  const notes = await getTechnicalNotes(registrationId);
  return NextResponse.json({ notes });
}

export async function PUT(request: Request, { params }: { params: Promise<{ registrationId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { registrationId } = await params;

  const body = (await request.json().catch(() => null)) as {
    phase?: NotePhase;
    ratings?: Record<string, number | null>;
    strengths?: string | null;
    areasToImprove?: string | null;
    coachNotes?: string | null;
  } | null;
  if (!body?.phase) return jsonError("Phase requise (initial ou final)", 400);

  const role = await getCurrentAdminRole();
  await setTechnicalNotes(registrationId, body.phase, body.ratings ?? {}, body.strengths ?? null, body.areasToImprove ?? null, body.coachNotes ?? null, role);
  return NextResponse.json({ ok: true });
}
