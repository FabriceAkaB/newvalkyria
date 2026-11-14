import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { getCurrentAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { updateIdea } from "@/lib/idea-box-repo";

export const dynamic = "force-dynamic";

const schema = z.object({
  id: z.string().uuid(),
  status: z.enum(["nouvelle", "a_l_etude", "retenue", "realisee", "non_retenue"]).optional(),
  response: z.string().max(2000).nullable().optional(),
  shownPublicly: z.boolean().optional(),
  notify: z.boolean().optional()
});

/** Boîte à idées (admin et gérante) : statut, réponse à l'auteur, affichage sur le site. */
export async function POST(request: Request) {
  const role = await getCurrentAdminRole();
  if (role !== "admin" && role !== "gerante") return jsonError("Non autorisé", 401);
  try {
    const body = schema.parse(await request.json());
    const r = await updateIdea(body.id, body);
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    if (err instanceof ZodError) return jsonError("Données invalides", 400);
    console.error("Idea update failed", err);
    return jsonError(err instanceof Error ? err.message : "Erreur", 500);
  }
}
