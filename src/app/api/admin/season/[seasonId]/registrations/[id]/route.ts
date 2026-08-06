import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import type { RegistrationStatus } from "@/lib/season-admin-repo";
import { convertTrialToOfficial, deleteRegistration, updateRegistration } from "@/lib/season-admin-repo";

const VALID_STATUSES: readonly string[] = ["pending", "confirmed", "paid", "waitlist", "cancelled"] satisfies readonly RegistrationStatus[];

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }
  const { id } = await params;
  try {
    await deleteRegistration(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de suppression", 500);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }
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
        halfSeasonEndsOn: body.halfSeasonEndsOn
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de sauvegarde", 500);
  }
}
