import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getRegistrationById } from "@/lib/season-admin-repo";
import { confirmRegistration, createRegistration, enrollInAllActiveSessions, enrollInDiagnosticOnly, type RegistrationOption } from "@/lib/sport-etudes-repo";

const FULL_PROGRAM_PRICE_CENTS = 31595;

/** Transfère une inscription (fille, autre saison) vers le programme
 *  Sport-Études (garçons) — crée une NOUVELLE inscription Sport-Études, ne
 *  touche jamais à l'inscription d'origine. Miroir de transfer-to-ete. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id: registrationId } = await params;

  const body = (await request.json().catch(() => null)) as {
    playerFirstName?: string;
    playerLastName?: string;
    playerDob?: string | null;
    parentFirstName?: string;
    parentLastName?: string;
    parentEmail?: string;
    parentPhone?: string;
    optionChosen?: RegistrationOption;
  } | null;

  if (!body?.playerFirstName?.trim() || !body.playerLastName?.trim() || !body.parentFirstName?.trim() || !body.parentLastName?.trim() || !body.parentEmail?.trim() || !body.parentPhone?.trim()) {
    return jsonError("Prénom/nom du joueur et coordonnées complètes du parent sont requis", 400);
  }
  const optionChosen: RegistrationOption = body.optionChosen === "full_program" ? "full_program" : "diagnostic_only";

  const registration = await getRegistrationById(registrationId);
  if (!registration) return jsonError("Inscription introuvable", 404);

  const newRegistrationId = await createRegistration({
    playerId: registration.player_id,
    parentUserId: null,
    playerFirstName: body.playerFirstName.trim(),
    playerLastName: body.playerLastName.trim(),
    playerDob: body.playerDob?.trim() || null,
    playerBirthYear: null,
    playerLevel: null,
    primaryPosition: null,
    secondaryPosition: null,
    currentTeam: null,
    currentClub: null,
    soccerExperience: null,
    playerGoals: null,
    parentAssessedStrengths: null,
    parentAssessedAreasToImprove: null,
    parentFirstName: body.parentFirstName.trim(),
    parentLastName: body.parentLastName.trim(),
    parentEmail: body.parentEmail.trim(),
    parentPhone: body.parentPhone.trim(),
    parentRelationship: null,
    sportEtudesExperience: null,
    priorEvaluationsDone: null,
    targetSportEtudesProgram: null,
    comments: null,
    importantCoachInfo: null,
    termsAccepted: true,
    optionChosen,
    priceCents: optionChosen === "full_program" ? FULL_PROGRAM_PRICE_CENTS : 0,
    transferredFromRegistrationId: registrationId
  });

  if (optionChosen === "diagnostic_only") {
    await enrollInDiagnosticOnly(newRegistrationId);
    await confirmRegistration(newRegistrationId);
  } else {
    await enrollInAllActiveSessions(newRegistrationId);
  }

  return NextResponse.json({ ok: true, registrationId: newRegistrationId });
}
