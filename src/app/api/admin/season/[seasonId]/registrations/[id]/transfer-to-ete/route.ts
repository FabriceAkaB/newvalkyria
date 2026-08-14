import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { createLeadAdmin } from "@/lib/repositories";
import { getRegistrationById } from "@/lib/season-admin-repo";

/** Transfère une inscription d'une autre saison vers Été 2026 — crée un
 *  NOUVEAU lead, ne touche jamais à l'inscription d'origine (elle reste
 *  telle quelle dans sa saison d'origine). Miroir de
 *  /api/admin/leads/[id]/transfer (Été → autre saison). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id: registrationId } = await params;

  const body = (await request.json().catch(() => null)) as {
    parentName?: string;
    parentEmail?: string;
    parentPhone?: string;
    city?: string | null;
    playerFirstName?: string | null;
    playerLastName?: string | null;
    playerAge?: string;
    playerLevel?: string;
    goal?: string;
    availability?: string;
  } | null;

  if (!body?.parentName?.trim() || !body.parentEmail?.trim() || !body.parentPhone?.trim() || !body.playerAge?.trim()) {
    return jsonError("Nom, courriel, téléphone du parent et catégorie de la joueuse sont requis", 400);
  }

  const registration = await getRegistrationById(registrationId);
  if (!registration) return jsonError("Inscription introuvable", 404);

  const childName = `${body.playerFirstName ?? ""} ${body.playerLastName ?? ""}`.trim() || "Non spécifié";
  const goal = body.goal?.trim() || `Joueuse: ${childName} · Poste: Non spécifié · Club: Aucun`;

  const leadId = await createLeadAdmin({
    parentName: body.parentName.trim(),
    email: body.parentEmail.trim(),
    phone: body.parentPhone.trim(),
    city: body.city?.trim() || null,
    playerAge: body.playerAge.trim(),
    playerLevel: body.playerLevel?.trim() || "Intermédiaire",
    goal,
    availability: body.availability?.trim() || "Flexible",
    playerId: registration.player_id,
    transferredFromRegistrationId: registrationId
  });

  return NextResponse.json({ ok: true, leadId });
}
