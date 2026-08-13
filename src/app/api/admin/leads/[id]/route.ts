import { NextResponse } from "next/server";

import { getCurrentAdminRole, isAdminRequest } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { jsonError } from "@/lib/http";
import { deleteLead, getAllLeads, updateLeadGoal, updateLeadStatus, updateLeadTimeSlot, updateLeadTrialDate } from "@/lib/repositories";

const ACTOR_LABEL: Record<"admin" | "gerante", string> = { admin: "JP", gerante: "Gérante" };

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const role = await getCurrentAdminRole();
  if (!role) return jsonError("Non autorisé", 401);

  const { id } = await params;
  if (!id) {
    return jsonError("ID manquant", 400);
  }

  const before = (await getAllLeads()).find((l) => l.id === id);
  await deleteLead(id);
  if (before) {
    await logAudit({
      actorRole: role,
      actorLabel: ACTOR_LABEL[role],
      action: "delete",
      entityType: "lead",
      entityId: id,
      entityLabel: before.parent_name,
      before
    });
  }
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

  const body = (await request.json()) as { goal?: string; status?: string; time_slot?: string; trial_date?: string | null };

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

  if (body.trial_date !== undefined) {
    if (body.trial_date && body.trial_date < new Date().toISOString().slice(0, 10)) {
      return jsonError("La date d'essai ne peut pas être dans le passé", 400);
    }
    await updateLeadTrialDate(id, body.trial_date);
    updated = true;
  }

  if (!updated) {
    return jsonError("Aucun champ à mettre à jour", 400);
  }

  return NextResponse.json({ ok: true });
}
