import { NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { jsonError } from "@/lib/http";
import { addOrderProblem, type ProblemType } from "@/lib/shop-repo";

const VALID_TYPES: readonly string[] = [
  "mauvaise_taille", "article_manquant", "mauvais_article", "quantite_incorrecte",
  "article_endommage", "commande_incomplete", "echange_demande", "retour_fournisseur", "autre"
] satisfies readonly ProblemType[];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) return jsonError("Non autorisé", 401);
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { problemType?: string; description?: string | null } | null;
  if (!body?.problemType || !VALID_TYPES.includes(body.problemType)) return jsonError("Type de problème invalide", 400);

  await addOrderProblem(id, body.problemType as ProblemType, body.description ?? null);
  return NextResponse.json({ ok: true });
}
