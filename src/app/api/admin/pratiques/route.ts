import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { createActivityFor } from "@/lib/practices-repo";

export const dynamic = "force-dynamic";

const time = z.string().regex(/^\d{2}:\d{2}$/);
const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: time,
  end: time.nullable(),
  location: z.string().max(300),
  group: z.string().min(1).max(160),
  organization: z.string().max(120).nullable().optional(),
  type: z.enum(["Pratique", "Match", "Tournoi", "Camp", "Évaluation", "Autre"]).optional()
});

/** Crée l'activité d'une pratique (de l'horaire, ou donnée par JP hors Académie) pour y bâtir son plan de séance. */
export async function POST(request: Request) {
  if (!(await getCurrentAdminRole())) return jsonError("Non autorisé", 401);
  try {
    const b = schema.parse(await request.json());
    const id = await createActivityFor({ ...b, organization: b.organization?.trim() || null });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    if (err instanceof ZodError) return jsonError("Données invalides", 400);
    console.error("Practice create failed", err);
    return jsonError(err instanceof Error ? err.message : "Erreur", 500);
  }
}
