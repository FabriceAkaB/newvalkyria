import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { sendMatchRequestNotification } from "@/lib/email";
import { jsonError } from "@/lib/http";
import { teamYearsLabel } from "@/lib/match-slots-core";
import { createSlotRequests, getTeamProfileByToken, MatchConflictError } from "@/lib/match-slots-repo";

const schema = z.object({
  token: z.string().min(20, "Équipe inconnue"),
  slotIds: z.array(z.string().uuid()).min(1).max(2),
  message: z.string().max(1000).optional()
});

/** Demande d'une équipe pour une plage où elle n'est pas admissible d'office : l'académie approuve ou refuse. */
export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const profile = await getTeamProfileByToken(payload.token);
    if (!profile) return jsonError("Remplissez d'abord le formulaire de votre équipe.", 404);
    const slots = await createSlotRequests(profile.id, payload.slotIds, payload.message?.trim() || null);
    void sendMatchRequestNotification({
      orgName: profile.org_name,
      teamLabel: profile.team_label,
      category: `${profile.team_gender === "filles" ? "filles" : profile.team_gender === "garcons" ? "garçons" : "mixte"}, ${teamYearsLabel({ birthYear: profile.team_birth_year, birthYearTo: profile.team_birth_year_to })}`,
      level: profile.team_level,
      contactName: profile.contact_name,
      contactEmail: profile.contact_email,
      contactPhone: profile.contact_phone,
      message: payload.message?.trim() || null,
      slots
    }).catch((e) => console.error("Unable to send match request notification", e));
    return NextResponse.json({ ok: true, slotIds: slots.map((s) => s.id) });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Données invalides", 422);
    if (error instanceof MatchConflictError) return jsonError(error.message, 409);
    return jsonError(error instanceof Error ? error.message : "Erreur serveur", 422);
  }
}
