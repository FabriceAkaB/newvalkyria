import { NextResponse } from "next/server";

import { SEASON_DB_ID, SLOT_DB_ID } from "@/lib/season-2027-db-map";
import { getSeasonProgramCategories, getSeasonRegistrations, getSeasonSlots } from "@/lib/season-admin-repo";

export const dynamic = "force-dynamic";

/** Disponibilités réelles (places prises / max) calculées depuis les vraies
 *  inscriptions en base — utilisées par le tunnel public pour ne jamais
 *  afficher un nombre de places qui ne correspond pas à la réalité gérée
 *  par l'admin (capacité par programme/catégorie et par plage horaire). */
export async function GET() {
  const [programCategories, slots, registrations] = await Promise.all([
    getSeasonProgramCategories(SEASON_DB_ID),
    getSeasonSlots(SEASON_DB_ID),
    getSeasonRegistrations(SEASON_DB_ID)
  ]);

  const active = registrations.filter((r) => r.status !== "cancelled");

  const programCategory: Record<string, { max: number; taken: number }> = {};
  for (const pc of programCategories) {
    const taken = active.filter((r) => r.program_id === pc.program_id && r.category_id === pc.category_id).length;
    programCategory[`${pc.program_id}:${pc.category_id}`] = { max: pc.max_places, taken };
  }

  const reverseSlotId = new Map(Object.entries(SLOT_DB_ID).map(([staticId, dbId]) => [dbId, staticId]));
  const slotsOut: Record<string, { max: number; taken: number }> = {};
  for (const slot of slots) {
    const staticId = reverseSlotId.get(slot.id);
    if (!staticId) continue;
    const taken = active.filter((r) => r.time_slot_template_id === slot.id).length;
    slotsOut[staticId] = { max: slot.max_places, taken };
  }

  return NextResponse.json({ programCategory, slots: slotsOut });
}
