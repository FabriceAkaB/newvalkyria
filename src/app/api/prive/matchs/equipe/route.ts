import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { isValidPhone } from "@/lib/form-validation";
import { jsonError } from "@/lib/http";
import { MatchConflictError, saveTeamProfile, TEAM_LEVELS } from "@/lib/match-slots-repo";

export const dynamic = "force-dynamic";

const schema = z.object({
  orgName: z.string().trim().min(2, "Nom de l'académie ou du club requis"),
  teamLabel: z.string().trim().min(1, "Nom ou catégorie de l'équipe requis"),
  teamGender: z.enum(["filles", "garcons", "mixte"], { message: "Genre de l'équipe requis" }),
  teamBirthYear: z.number().int().min(2000, "Année de naissance invalide").max(2026, "Année de naissance invalide"),
  teamLevel: z.enum(TEAM_LEVELS, { message: "Niveau de l'équipe requis" }),
  teamPlayers: z.number().int().min(1, "Nombre de joueurs invalide").max(40, "Nombre de joueurs invalide").nullable().optional(),
  contactName: z.string().trim().min(2, "Nom du responsable requis"),
  contactEmail: z.string().trim().email("Courriel invalide"),
  contactPhone: z.string().refine(isValidPhone, "Numéro de téléphone invalide (10 chiffres)"),
  notes: z.string().optional()
});

/** Formulaire « Votre équipe » : étape obligatoire avant de pouvoir choisir une plage. */
export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const profile = await saveTeamProfile({
      orgName: payload.orgName,
      teamLabel: payload.teamLabel,
      teamGender: payload.teamGender,
      teamBirthYear: payload.teamBirthYear,
      teamLevel: payload.teamLevel,
      teamPlayers: payload.teamPlayers ?? null,
      contactName: payload.contactName,
      contactEmail: payload.contactEmail,
      contactPhone: payload.contactPhone,
      notes: payload.notes?.trim() || null
    });
    return NextResponse.json({ ok: true, profileId: profile.id });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    if (error instanceof MatchConflictError) return jsonError(error.message, 409);
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
