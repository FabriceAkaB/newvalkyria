import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { sendRegistrationCompletedEmail } from "@/lib/email";
import { isValidPhone } from "@/lib/form-validation";
import { jsonError } from "@/lib/http";
import { completeRegistration, getCompletionByToken } from "@/lib/registration-completions";

const schema = z.object({
  token: z.string().min(20),
  playerFirstName: z.string().trim().min(1, "Prénom du joueur requis"),
  playerLastName: z.string().trim().min(1, "Nom du joueur requis"),
  playerDob: z.string().trim().min(1, "Date de naissance requise"),
  parentName: z.string().trim().min(2, "Nom du parent requis"),
  parentPhone: z.string().refine(isValidPhone, "Numéro de téléphone invalide (10 chiffres)"),
  city: z.string().optional(),
  comments: z.string().optional(),
  termsAccepted: z.boolean().refine((v) => v, { message: "L'acceptation des conditions est obligatoire" })
});

/** Formulaire personnel envoyé par courriel à une famille ayant déjà payé : crée l'inscription interne. */
export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const completion = await getCompletionByToken(payload.token);
    if (!completion || completion.status === "cancelled") return jsonError("Ce lien n'est pas valide.", 404);
    if (completion.status === "completed") return jsonError("Ce formulaire a déjà été rempli : l'inscription est confirmée.", 409);

    const registrationId = await completeRegistration(completion, {
      playerFirstName: payload.playerFirstName,
      playerLastName: payload.playerLastName,
      playerDob: payload.playerDob,
      parentName: payload.parentName,
      parentPhone: payload.parentPhone,
      city: payload.city?.trim() || null,
      comments: payload.comments?.trim() || null
    });

    try {
      await sendRegistrationCompletedEmail({
        to: completion.parent_email,
        parentName: payload.parentName,
        playerName: `${payload.playerFirstName} ${payload.playerLastName}`.trim(),
        programSlug: completion.program_slug
      });
    } catch (error) {
      console.error("Unable to send registration completed email", error);
    }

    return NextResponse.json({ ok: true, registrationId });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
