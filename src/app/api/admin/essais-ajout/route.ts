import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { createRegistration, getAllTrialSlots } from "@/lib/season-admin-repo";

/** Ajoute une joueuse à l'essai à n'importe quelle journée (avec ou sans plage
 *  d'essai officielle) — utilisé depuis le calendrier des essais. Aucun courriel
 *  automatique : l'admin a déjà parlé à la famille. La capacité d'une plage n'est
 *  jamais bloquante ici (l'admin décide), elle est seulement signalée dans le
 *  calendrier. */
export async function POST(request: Request) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);

  const body = (await request.json().catch(() => null)) as {
    playerFirstName?: string;
    playerLastName?: string;
    parentName?: string;
    parentPhone?: string;
    parentEmail?: string;
    categoryId?: string | null;
    date?: string;
    trialSlotId?: string | null;
  } | null;

  const first = body?.playerFirstName?.trim();
  if (!first) return jsonError("Le prénom de la joueuse est requis", 400);
  if (!body?.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return jsonError("Date d'essai invalide", 400);

  let trialDate = body.date;
  let trialSlotId: string | null = null;
  if (body.trialSlotId) {
    const slot = (await getAllTrialSlots()).find((s) => s.id === body.trialSlotId);
    if (!slot) return jsonError("Cette plage d'essai n'existe plus.", 404);
    trialSlotId = slot.id;
    trialDate = slot.slot_date;
  }

  try {
    const id = await createRegistration({
      seasonId: SEASON_DB_ID,
      programId: null,
      categoryId: body.categoryId || null,
      timeSlotTemplateId: null,
      parentName: body.parentName?.trim() || "(parent à compléter)",
      parentEmail: body.parentEmail?.trim() || "en-attente@newvalkyria.temp",
      parentPhone: body.parentPhone?.trim() || "",
      city: null,
      playerFirstName: first,
      playerLastName: body.playerLastName?.trim() || null,
      playerDob: null,
      advancedGroup: false,
      isTrial: true,
      trialSlotId,
      trialDate
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}
