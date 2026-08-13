import { NextResponse } from "next/server";

import { getCurrentAdminRole, isAdminRequest } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { deleteCoach, getCoach, updateCoach } from "@/lib/coaches-repo";
import { jsonError } from "@/lib/http";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    email?: string | null;
    status?: "active" | "inactive";
    role?: string;
    defaultHourlyRateCents?: number;
    hiredOn?: string | null;
    notes?: string | null;
  } | null;

  if (!body) return jsonError("Paramètres invalides", 400);

  await updateCoach(id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentAdminRole();
  if (role !== "admin") return jsonError("Non autorisé", 401);
  const { id } = await params;
  const before = await getCoach(id);
  await deleteCoach(id);
  if (before) {
    await logAudit({
      actorRole: role,
      actorLabel: "JP",
      action: "delete",
      entityType: "coach",
      entityId: id,
      entityLabel: `${before.first_name} ${before.last_name}`,
      before
    });
  }
  return NextResponse.json({ ok: true });
}
