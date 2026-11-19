import { NextResponse } from "next/server";

import { getCurrentCoachId } from "@/lib/coach-auth";
import { getCoach } from "@/lib/coaches-repo";
import { getAllContracts, maskedPath, signedUrl } from "@/lib/employee-contracts";
import { jsonError } from "@/lib/http";

/** Mon contrat (portail des éducateurs) : la copie signée avec le NAS masqué, lien de 5 minutes. */
export async function GET(request: Request) {
  const coachId = await getCurrentCoachId();
  if (!coachId) return jsonError("Non autorisé", 401);
  const coach = await getCoach(coachId);
  const email = coach?.email?.trim().toLowerCase();
  if (!email) return jsonError("Aucun contrat à ton courriel.", 404);
  const contract = (await getAllContracts())
    .filter((c) => c.employee_email?.trim().toLowerCase() === email && c.signed_at)
    .sort((a, b) => String(b.signed_at).localeCompare(String(a.signed_at)))[0];
  if (!contract) return jsonError("Aucun contrat signé à ton courriel.", 404);
  const url = await signedUrl(maskedPath(contract), 300);
  if (!url) return jsonError("Le contrat n'a pas pu s'ouvrir. Réessaie.", 404);
  return NextResponse.redirect(url);
}
