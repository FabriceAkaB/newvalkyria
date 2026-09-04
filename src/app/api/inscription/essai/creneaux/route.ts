import { NextResponse } from "next/server";

import { getActiveTrialSlots } from "@/lib/season-admin-repo";

/** Public — les dates d'essai disponibles pour septembre 2026, avec places
 *  restantes calculées en direct. Le filtrage par année de naissance/niveau
 *  se fait côté client (formulaire), cette route renvoie tout l'inventaire
 *  actif ; seule la capacité est vérifiée à nouveau côté serveur au moment
 *  de la soumission (voir /api/inscription/essai). */
export async function GET() {
  const slots = await getActiveTrialSlots();
  return NextResponse.json({ slots });
}
