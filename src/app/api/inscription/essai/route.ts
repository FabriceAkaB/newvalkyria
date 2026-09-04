import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { sendLeadNotificationEmail, sendSeasonTrialConfirmationEmail } from "@/lib/email";
import { jsonError } from "@/lib/http";
import { createRegistration, getTrialSlotById } from "@/lib/season-admin-repo";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { seasonTrialSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const payload = seasonTrialSchema.parse(await request.json());

    let trialDate: string | null = null;
    if (payload.trialSlotId) {
      const slot = await getTrialSlotById(payload.trialSlotId);
      if (!slot) return jsonError("Cette date d'essai n'existe plus.", 404);
      if (slot.isFull) return jsonError("Cette date d'essai est déjà complète — merci d'en choisir une autre.", 409);
      trialDate = slot.slot_date;
    }

    const id = await createRegistration({
      seasonId: SEASON_DB_ID,
      programId: null,
      categoryId: null,
      timeSlotTemplateId: null,
      parentName: payload.parentName,
      parentEmail: payload.parentEmail,
      parentPhone: payload.parentPhone,
      city: payload.city,
      playerFirstName: payload.playerFirstName,
      playerLastName: payload.playerLastName,
      playerDob: payload.playerDob ?? null,
      advancedGroup: false,
      isTrial: true,
      trialSlotId: payload.trialSlotId ?? null,
      trialDate
    });

    void sendLeadNotificationEmail({
      parent_name: payload.parentName,
      email: payload.parentEmail,
      phone: payload.parentPhone,
      player_age: payload.playerDob ? payload.playerDob.slice(0, 4) : "essai",
      player_level: "Intermédiaire",
      city: payload.city,
      goal: "Essai gratuit — Automne/Hiver 2026",
      availability: "À planifier",
      consent: true,
      player_name: `${payload.playerFirstName} ${payload.playerLastName}`.trim()
    }).catch((err) => console.error("Trial admin notification email error:", err));

    void sendSeasonTrialConfirmationEmail({
      to: payload.parentEmail,
      parentName: payload.parentName
    }).catch((err) => console.error("Trial client confirmation email error:", err));

    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      const firstMessage = error.issues[0]?.message ?? "Données invalides";
      return jsonError(firstMessage, 422);
    }
    if (error instanceof Error) {
      return jsonError(error.message, 422);
    }
    return jsonError("Erreur serveur", 500);
  }
}
