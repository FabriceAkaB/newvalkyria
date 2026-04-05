import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { sendLeadNotificationEmail } from "@/lib/email";
import { appendLeadToSheet } from "@/lib/google-sheets";
import { jsonError } from "@/lib/http";
import { saveLead } from "@/lib/repositories";
import { leadFormSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const isWaitlist = body.isWaitlist === true;
    const payload = leadFormSchema.parse(body);
    const { leadId, mode } = await saveLead(payload, isWaitlist);

    // Fire-and-forget — ne bloque jamais le flow d'inscription
    void Promise.allSettled([
      sendLeadNotificationEmail(payload),
      appendLeadToSheet(payload)
    ]);

    return NextResponse.json({ leadId, mode }, { status: 201 });
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
