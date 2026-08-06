import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { removeAssignment, updateAssignment } from "@/lib/coaches-repo";
import { jsonError } from "@/lib/http";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as {
    status?: "present" | "absent" | "replaced" | "cancelled";
    arrivalTime?: string | null;
    departureTime?: string | null;
    hourlyRateCents?: number | null;
    confirmed?: boolean;
    paid?: boolean;
    paidOn?: string | null;
    paymentMethod?: string | null;
    paymentReference?: string | null;
    paymentNotes?: string | null;
  } | null;

  if (!body) return jsonError("Paramètres invalides", 400);

  await updateAssignment(id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;
  await removeAssignment(id);
  return NextResponse.json({ ok: true });
}
