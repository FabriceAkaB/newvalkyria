import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { updateProgramCategoryMax, updateSlot } from "@/lib/season-admin-repo";

/** Body: soit { kind: "program", programId, categoryId, maxPlaces },
 *  soit { kind: "slot", slotId, maxPlaces }. */
export async function PATCH(request: Request, { params }: { params: Promise<{ seasonId: string }> }) {
  if (!(await isAdminRequest())) {
    return jsonError("Non autorisé", 401);
  }

  const { seasonId } = await params;
  const body = (await request.json().catch(() => null)) as
    | { kind: "program"; programId: string; categoryId: string; maxPlaces: number }
    | { kind: "slot"; slotId: string; maxPlaces: number }
    | null;

  if (!body || typeof body.maxPlaces !== "number" || body.maxPlaces < 0) {
    return jsonError("Paramètres invalides", 400);
  }

  try {
    if (body.kind === "program") {
      if (!body.programId || !body.categoryId) return jsonError("Paramètres invalides", 400);
      await updateProgramCategoryMax(seasonId, body.programId, body.categoryId, body.maxPlaces);
    } else if (body.kind === "slot") {
      if (!body.slotId) return jsonError("Paramètres invalides", 400);
      await updateSlot(body.slotId, { maxPlaces: body.maxPlaces });
    } else {
      return jsonError("Paramètres invalides", 400);
    }
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de sauvegarde", 500);
  }

  return NextResponse.json({ ok: true });
}
