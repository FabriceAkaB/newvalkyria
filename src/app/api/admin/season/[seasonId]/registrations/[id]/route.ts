import { NextResponse } from "next/server";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-repo";
import { jsonError } from "@/lib/http";
import type { RegistrationStatus } from "@/lib/season-admin-repo";
import { convertTrialToOfficial, deleteRegistration, getRegistrationById, updateRegistration } from "@/lib/season-admin-repo";

const VALID_STATUSES: readonly string[] = ["pending", "confirmed", "paid", "waitlist", "cancelled"] satisfies readonly RegistrationStatus[];
const ACTOR_LABEL: Record<"admin" | "gerante", string> = { admin: "JP", gerante: "Gérante" };

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
        entityType: "registration",
        entityId: id,
        entityLabel: `${before.player_first_name ?? ""} ${before.player_last_name ?? ""}`.trim() || before.parent_name,
        before
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de suppression", 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const role = await getCurrentAdminRole();
  if (!role) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    programId?: string | null;
    categoryId?: string | null;
    timeSlotTemplateId?: string | null;
    advancedGroup?: boolean;
    status?: string;
    isTrial?: boolean;
    trialDate?: string | null;
    isHalfSeason?: boolean;
    halfSeasonEndsOn?: string | null;
    parentName?: string;
    parentEmail?: string;
    parentPhone?: string;
    city?: string | null;
    playerFirstName?: string | null;
    playerLastName?: string | null;
    playerDob?: string | null;
    convertToOfficial?: { programId: string; categoryId: string; timeSlotTemplateId: string | null };
  } | null;

  if (!body) return jsonError("Paramètres invalides", 400);
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return jsonError("Statut invalide", 400);
  }
  if (body.trialDate && body.trialDate < new Date().toISOString().slice(0, 10)) {
    return jsonError("La date d'essai ne peut pas être dans le passé", 400);
  }

  try {
    const before = body.status !== undefined ? await getRegistrationById(id) : null;

    if (body.convertToOfficial) {
      await convertTrialToOfficial(id, body.convertToOfficial);
    } else {
      await updateRegistration(id, {
        programId: body.programId,
        categoryId: body.categoryId,
        timeSlotTemplateId: body.timeSlotTemplateId,
        advancedGroup: body.advancedGroup,
        status: body.status as RegistrationStatus | undefined,
        isTrial: body.isTrial,
        trialDate: body.trialDate,
        isHalfSeason: body.isHalfSeason,
        halfSeasonEndsOn: body.halfSeasonEndsOn,
        parentName: body.parentName,
        parentEmail: body.parentEmail,
        parentPhone: body.parentPhone,
        city: body.city,
        playerFirstName: body.playerFirstName,
        playerLastName: body.playerLastName,
        playerDob: body.playerDob
      });
    }

    if (before && body.status !== undefined && before.status !== body.status) {
      await logAudit({
        actorRole: role,
        actorLabel: ACTOR_LABEL[role],
        action: "status_change",
        entityType: "registration",
        entityId: id,
        entityLabel: `${before.player_first_name ?? ""} ${before.player_last_name ?? ""}`.trim() || before.parent_name,
        before: { status: before.status },
        after: { status: body.status }
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de sauvegarde", 500);
  }
}
