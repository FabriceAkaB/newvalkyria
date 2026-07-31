import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import {
  getSeasonCategories,
  getSeasonPrograms,
  getSeasonProgramCategories,
  getSeasonRegistrations,
  getSeasonSlots
} from "@/lib/season-admin-repo";

export async function GET(_request: Request, { params }: { params: Promise<{ seasonId: string }> }) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }

  const { seasonId } = await params;

  try {
    const [categories, programs, programCategories, slots, registrations] = await Promise.all([
      getSeasonCategories(seasonId),
      getSeasonPrograms(seasonId),
      getSeasonProgramCategories(seasonId),
      getSeasonSlots(seasonId),
      getSeasonRegistrations(seasonId)
    ]);

    return NextResponse.json({ categories, programs, programCategories, slots, registrations });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de chargement", 500);
  }
}
