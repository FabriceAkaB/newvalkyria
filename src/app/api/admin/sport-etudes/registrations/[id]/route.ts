import { NextResponse } from "next/server";

import { getCurrentAdminRole, isAdminRequest } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { jsonError } from "@/lib/http";
import { deleteRegistration, getRegistrationById, updateRegistrationStatus, type RegistrationStatus } from "@/lib/sport-etudes-repo";

const VALID_STATUSES: readonly string[] = ["pending", "confirmed", "paid", "cancelled"] satisfies readonly RegistrationStatus[];
const ACTOR_LABEL: Record<"admin" | "gerante", string> = { admin: "JP", gerante: "Gérante" };

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentAdminRole();
  if (!role) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  if (!body?.status || !VALID_STATUSES.includes(body.status)) return jsonError("Statut invalide", 400);

  try {
    const before = await getRegistrationById(id);
    await updateRegistrationStatus(id, body.status as RegistrationStatus);

    if (before && before.status !== body.status) {
      await logAudit({
        actorRole: role,
        actorLabel: ACTOR_LABEL[role],
        action: "status_change",
        entityType: "sport_etudes_registration",
        entityId: id,
        entityLabel: `${before.player_first_name} ${before.player_last_name}`.trim(),
        before: { status: before.status },
        after: { status: body.status }
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentAdminRole();
  if (!role) return jsonError("Non autorisé", 401);
  const { id } = await params;

  try {
    const before = await getRegistrationById(id);
    await deleteRegistration(id);

    if (before) {
      await logAudit({
        actorRole: role,
        actorLabel: ACTOR_LABEL[role],
        action: "delete",
        entityType: "sport_etudes_registration",
        entityId: id,
        entityLabel: `${before.player_first_name} ${before.player_last_name}`.trim(),
        before
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
