import { NextResponse } from "next/server";

import { getCurrentAdminRole, isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { setAttendance, type AttendanceStatus } from "@/lib/sport-etudes-repo";

export async function PATCH(request: Request, { params }: { params: Promise<{ enrollmentId: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { enrollmentId } = await params;

  const body = (await request.json().catch(() => null)) as { status?: AttendanceStatus; notes?: string | null } | null;
  if (!body?.status) return jsonError("Statut requis", 400);

  const role = await getCurrentAdminRole();
  await setAttendance(enrollmentId, body.status, role, body.notes ?? null);
  return NextResponse.json({ ok: true });
}
