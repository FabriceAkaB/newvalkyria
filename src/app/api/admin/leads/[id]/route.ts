import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { deleteLead, updateLeadGoal, updateLeadStatus, updateLeadTimeSlot } from "@/lib/repositories";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }

  const { id } = await params;
  if (!id) {
    return jsonError("ID manquant", 400);
  }

  await deleteLead(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }

  const { id } = await params;
  if (!id) {
    return jsonError("ID manquant", 400);
  }

  const body = (await request.json()) as { goal?: string; status?: string; time_slot?: string };

  let updated = false;

  if (body.goal !== undefined) {
    await updateLeadGoal(id, body.goal);
    updated = true;
  }

  if (body.status !== undefined) {
    const allowed = ["pending", "confirmed", "paid", "cancelled", "essai"] as const;
    if (!allowed.includes(body.status as typeof allowed[number])) {
      return jsonError("Statut invalide", 400);
    }
    await updateLeadStatus(id, body.status as typeof allowed[number]);
    updated = true;
  }

  if (body.time_slot !== undefined) {
    await updateLeadTimeSlot(id, body.time_slot);
    updated = true;
  }

  if (!updated) {
    return jsonError("Aucun champ à mettre à jour", 400);
  }

  return NextResponse.json({ ok: true });
}
