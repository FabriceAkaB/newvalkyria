import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { isValidPhone } from "@/lib/form-validation";
import { jsonError } from "@/lib/http";
import { sendMatchTeamLinkEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { getTeamProfileByToken, MatchConflictError, saveTeamProfile, TEAM_LEVELS, type MatchTeamProfile } from "@/lib/match-slots-repo";

function publicProfile(p: MatchTeamProfile) {
  return {
    profileId: p.id,
    token: p.access_token,
    orgName: p.org_name,
    teamLabel: p.team_label,
    teamGender: p.team_gender,
    teamBirthYear: p.team_birth_year,
    teamBirthYearTo: p.team_birth_year_to ?? p.team_birth_year,
    teamLevel: p.team_level,
    teamPlayers: p.team_players,
    contactName: p.contact_name,
    contactEmail: p.contact_email,
    contactPhone: p.contact_phone,
    notes: p.notes
  };
}

/** Retrouver son équipe par son lien personnel (aucun formulaire à refaire). */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const profile = await getTeamProfileByToken(token);
  if (!profile) return jsonError("Équipe introuvable", 404);
  return NextResponse.json({ ok: true, profile: publicProfile(profile) });
}

export const dynamic = "force-dynamic";

const schema = z.object({
  orgName: z.string().trim().min(2, "Nom de l'académie ou du club requis"),
  teamLabel: z.string().trim().min(1, "Nom ou catégorie de l'équipe requis"),
  teamGender: z.enum(["filles", "garcons", "mixte"], { message: "Genre de l'équipe requis" }),
  teamBirthYear: z.number().int().min(2000, "Année de naissance invalide").max(2026, "Année de naissance invalide"),
  teamBirthYearTo: z.number().int().min(2000).max(2026).nullable().optional(),
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
      teamBirthYearTo: payload.teamBirthYearTo && payload.teamBirthYearTo > payload.teamBirthYear && payload.teamBirthYearTo - payload.teamBirthYear <= 2 ? payload.teamBirthYearTo : payload.teamBirthYear,
      teamLevel: payload.teamLevel,
      teamPlayers: payload.teamPlayers ?? null,
      contactName: payload.contactName,
      contactEmail: payload.contactEmail,
      contactPhone: payload.contactPhone,
      notes: payload.notes?.trim() || null
    });
    // Courriel avec le lien personnel : pour revenir réserver sans refaire le formulaire.
    const link = `${env.publicSiteUrl}/prive/matchs?equipe=${profile.access_token}`;
    void sendMatchTeamLinkEmail({ to: profile.contact_email, contactName: profile.contact_name, orgName: profile.org_name, teamLabel: profile.team_label, link }).catch((e) =>
      console.error("Unable to send match team link email", e)
    );
    return NextResponse.json({ ok: true, profileId: profile.id, token: profile.access_token, profile: publicProfile(profile) });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    if (error instanceof MatchConflictError) return jsonError(error.message, 409);
    if (error instanceof Error) return jsonError(error.message, 422);
    return jsonError("Erreur serveur", 500);
  }
}
