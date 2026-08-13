import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { createRegistration, type RegistrationStatus } from "@/lib/season-admin-repo";

const VALID_STATUSES: readonly string[] = ["pending", "confirmed", "paid", "waitlist", "cancelled"] satisfies readonly RegistrationStatus[];

/** Transfère une inscription Été 2026 (lead) vers une inscription d'une
 *  autre saison — crée une NOUVELLE inscription, ne touche jamais au lead
 *  d'origine (il reste tel quel dans Été 2026). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id: leadId } = await params;

  const body = (await request.json().catch(() => null)) as {
    seasonId?: string;
    programId?: string | null;
    categoryId?: string | null;
    timeSlotTemplateId?: string | null;
    parentName?: string;
    parentEmail?: string;
    parentPhone?: string;
    city?: string | null;
    playerFirstName?: string | null;
    playerLastName?: string | null;
    playerDob?: string | null;
    advancedGroup?: boolean;
    status?: string;
  } | null;

  if (!body?.seasonId || !body.parentName?.trim() || !body.parentEmail?.trim() || !body.parentPhone?.trim()) {
    return jsonError("Saison, nom, courriel et téléphone du parent sont requis", 400);
  }
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return jsonError("Statut invalide", 400);
  }

  const registrationId = await createRegistration({
    seasonId: body.seasonId,
    programId: body.programId ?? null,
    categoryId: body.categoryId ?? null,
    timeSlotTemplateId: body.timeSlotTemplateId ?? null,
    parentName: body.parentName.trim(),
    parentEmail: body.parentEmail.trim(),
    parentPhone: body.parentPhone.trim(),
    city: body.city ?? null,
    playerFirstName: body.playerFirstName ?? null,
    playerLastName: body.playerLastName ?? null,
    playerDob: body.playerDob ?? null,
    advancedGroup: Boolean(body.advancedGroup),
    isTrial: false,
    status: (body.status as RegistrationStatus | undefined) ?? "pending",
    transferredFromLeadId: leadId
  });

  return NextResponse.json({ ok: true, registrationId });
}
