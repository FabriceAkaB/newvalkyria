import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { getMatchEvaluations } from "@/lib/match-repo";

/** Lecture seule côté admin — les évaluations post-match sont saisies par
 *  les entraîneurs (voir /api/coach/activities/[id]/match/evaluations),
 *  l'admin ne fait que les consulter (aucune donnée financière ici). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest({ roles: ["admin"] }))) return jsonError("Non autorisé", 401);
  const { id } = await params;
  const evaluations = await getMatchEvaluations(id);
  return NextResponse.json({ evaluations });
}
