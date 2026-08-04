import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { sendLeadNotificationEmail, sendWaitlistConfirmationEmail } from "@/lib/email";
import { jsonError } from "@/lib/http";
import { createWaitlistRegistration, getSeasonPrograms } from "@/lib/season-admin-repo";
import { SEASON_DB_ID } from "@/lib/season-2027-db-map";
import { seasonWaitlistSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const payload = seasonWaitlistSchema.parse(await request.json());

    const programs = await getSeasonPrograms(SEASON_DB_ID);
    const program = programs.find((p) => p.id === payload.programCode);
    if (!program) return jsonError("Programme introuvable", 404);

    const id = await createWaitlistRegistration({
      seasonId: SEASON_DB_ID,
      programId: payload.programCode,
      categoryId: payload.year,
      timeSlotTemplateId: null,
      parentName: payload.parentName,
      parentEmail: payload.parentEmail,
      parentPhone: payload.parentPhone,
      city: payload.city,
      playerFirstName: payload.playerFirstName,
      playerLastName: payload.playerLastName,
      playerDob: payload.playerDob ?? null,
      advancedGroup: payload.variant === "advanced",
      isTrial: false
    });

    void sendLeadNotificationEmail({
      parent_name: payload.parentName,
      email: payload.parentEmail,
      phone: payload.parentPhone,
      player_age: payload.year,
      player_level: "Intermédiaire",
      city: payload.city,
      goal: `Liste d'attente — ${program.name} — Automne/Hiver 2026`,
      availability: "Liste d'attente",
      consent: true,
      player_name: `${payload.playerFirstName} ${payload.playerLastName}`.trim()
    }).catch((err) => console.error("Waitlist admin notification email error:", err));

    void sendWaitlistConfirmationEmail({
      to: payload.parentEmail,
      parentName: payload.parentName,
      programName: program.name
    }).catch((err) => console.error("Waitlist client confirmation email error:", err));

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
