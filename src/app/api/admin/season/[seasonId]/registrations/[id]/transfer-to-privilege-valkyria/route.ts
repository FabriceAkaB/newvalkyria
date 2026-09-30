import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getRegistrationById } from "@/lib/season-admin-repo";
import { countActiveRegistrations, createRegistration, enrollInAllDates, getProgram } from "@/lib/session-programs-repo";

/** Transfère une inscription Automne/Hiver vers Privilège Valkyria (samedi,
 *  2013-2012) — crée une NOUVELLE inscription dans session_program_registrations,
 *  ne touche jamais à l'inscription d'origine. Miroir de transfer-to-sport-etudes. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id: registrationId } = await params;

  const body = (await request.json().catch(() => null)) as {
    playerFirstName?: string;
    playerLastName?: string;
    playerDob?: string | null;
    parentName?: string;
    parentEmail?: string;
    parentPhone?: string;
    city?: string | null;
  } | null;

  if (!body?.playerFirstName?.trim() || !body.playerLastName?.trim() || !body.parentName?.trim() || !body.parentEmail?.trim() || !body.parentPhone?.trim()) {
    return jsonError("Prénom/nom de la joueuse et coordonnées complètes du parent sont requis", 400);
  }

  const registration = await getRegistrationById(registrationId);
  if (!registration) return jsonError("Inscription introuvable", 404);

  const program = await getProgram("privilege-valkyria");
  if (!program) return jsonError("Programme introuvable", 404);

  const count = await countActiveRegistrations("privilege-valkyria");
  if (count >= program.max_capacity) return jsonError("Privilège Valkyria est complet pour le moment.", 409);

  const newRegistrationId = await createRegistration({
    programSlug: "privilege-valkyria",
    playerId: registration.player_id,
    playerFirstName: body.playerFirstName.trim(),
    playerLastName: body.playerLastName.trim(),
    playerDob: body.playerDob?.trim() || null,
    parentName: body.parentName.trim(),
    parentEmail: body.parentEmail.trim(),
    parentPhone: body.parentPhone.trim(),
    city: body.city?.trim() || null,
    comments: null,
    termsAccepted: true,
    priceCents: program.price_cents
  });

  await enrollInAllDates(newRegistrationId, "privilege-valkyria");

  return NextResponse.json({ ok: true, registrationId: newRegistrationId });
}
